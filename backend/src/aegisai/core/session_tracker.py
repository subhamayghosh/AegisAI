from __future__ import annotations

import threading
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegisai.db.models import Inspection
from aegisai.schemas import Decision, TierSignal

_DECAY = 0.9
_SIGNAL_WEIGHT = 0.4

# The synchronous helpers remain useful for unit-level scoring tests. The
# request pipeline uses the persisted score helpers below so multi-worker
# deployments do not split a session's suspicion history across processes.
_scores: dict[str, float] = {}
_lock = threading.Lock()


def next_score(previous_score: float, signals: list[TierSignal]) -> float:
    """Calculate the next score from a persisted prior score."""
    peak = max((s.confidence for s in signals if s.flagged), default=0.0)
    return min(1.0, previous_score * _DECAY + peak * _SIGNAL_WEIGHT)


async def load_persisted_score(
    db: AsyncSession, user_id: UUID, session_id: UUID
) -> float:
    """Load the latest session score from the database for worker-safe state."""
    result = await db.execute(
        select(Inspection.session_suspicion_score)
        .where(Inspection.user_id == user_id, Inspection.session_id == session_id)
        .order_by(Inspection.turn_id.desc(), Inspection.created_at.desc())
        .limit(1)
    )
    value = result.scalar_one_or_none()
    return float(value or 0.0)


def update(
    session_id: str | UUID, signals: list[TierSignal], decision: Decision | None = None
) -> float:
    """Fold one turn's signals into the session's suspicion score.

    new = min(1.0, existing * 0.9 + max(flagged confidence) * 0.4). A turn with
    no flagged signal contributes 0, so the score decays by 10% per quiet
    turn. ``decision`` is optional and does not affect the score — the
    pipeline updates the score *before* the policy decides, because the
    policy needs this turn's score.
    """
    _ = decision
    key = str(session_id)
    with _lock:
        new_score = next_score(_scores.get(key, 0.0), signals)
        _scores[key] = new_score
    return new_score


def get_score(session_id: str | UUID) -> float:
    with _lock:
        return _scores.get(str(session_id), 0.0)


def reset(session_id: str | UUID) -> None:
    with _lock:
        _scores.pop(str(session_id), None)


def reset_for_user(user_id: str | UUID) -> None:
    """Discard only one user's in-memory session scores after a history reset."""
    prefix = f"{user_id}:"
    with _lock:
        for key in [key for key in _scores if key.startswith(prefix)]:
            _scores.pop(key, None)
