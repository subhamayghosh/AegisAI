from __future__ import annotations

import threading
from uuid import UUID

from promptshield.schemas import Decision, TierSignal

_DECAY = 0.9
_SIGNAL_WEIGHT = 0.4

# In-memory, per-process store. Swap for Redis once the backend runs more
# than one worker — scores are not shared across processes today.
_scores: dict[str, float] = {}
_lock = threading.Lock()


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
    peak = max((s.confidence for s in signals if s.flagged), default=0.0)
    key = str(session_id)
    with _lock:
        new_score = min(1.0, _scores.get(key, 0.0) * _DECAY + peak * _SIGNAL_WEIGHT)
        _scores[key] = new_score
    return new_score


def get_score(session_id: str | UUID) -> float:
    with _lock:
        return _scores.get(str(session_id), 0.0)


def reset(session_id: str | UUID) -> None:
    with _lock:
        _scores.pop(str(session_id), None)
