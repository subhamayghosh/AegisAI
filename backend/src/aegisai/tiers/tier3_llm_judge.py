from __future__ import annotations

import asyncio
import time
import uuid

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import inspect as sa_inspect

from aegisai.config import resolve_model_ids
from aegisai.db.models import User, UserSettings
from aegisai.llm.client import get_judge_client
from aegisai.logging_ import get_logger
from aegisai.schemas import AttackType, SourceType, TierName, TierSignal

logger = get_logger(__name__)

JUDGE_TIMEOUT_S = 5.0
UNAVAILABLE_RULE = "tier3_unavailable"
# Judge reasoning lands in inspections.tier_signals; keep it short so it can't
# become a back door for storing the raw input the user didn't opt in to keep.
_MAX_NOTES_CHARS = 280


class _JudgeVerdict(BaseModel):
    flagged: bool
    attack_type: AttackType | None
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str


def _loaded_settings(user: User | None) -> UserSettings | None:
    """Return ``user.settings`` only if it is already loaded.

    Touching an unloaded relationship under AsyncSession raises
    MissingGreenlet, and this tier must never raise, so the caller is
    expected to eager-load it (``selectinload(User.settings)``).
    """
    if user is None:
        return None
    if "settings" in sa_inspect(user).unloaded:
        logger.warning("tier3_user_settings_not_loaded", user_id=str(user.id))
        return None
    return user.settings


def _elapsed_ms(started: float) -> int:
    return int(round((time.perf_counter() - started) * 1000))


def _unavailable(started: float, notes: str) -> TierSignal:
    return TierSignal(
        tier=TierName.tier3_llm_judge,
        flagged=False,
        attack_type=None,
        confidence=0.0,
        matched_rule=UNAVAILABLE_RULE,
        latency_ms=_elapsed_ms(started),
        notes=notes,
    )


async def detect(
    text: str,
    source_type: SourceType,
    session_context: str | None = None,
    user: User | None = None,
) -> TierSignal:
    """Ask the judge model for a verdict; degrade to an unflagged signal on any failure."""
    started = time.perf_counter()
    correlation_id = uuid.uuid4().hex
    _, judge_model_id = resolve_model_ids(_loaded_settings(user))

    try:
        raw = await asyncio.wait_for(
            get_judge_client().classify(
                text,
                source_type,
                session_context,
                judge_model_id,
                correlation_id=correlation_id,
            ),
            timeout=JUDGE_TIMEOUT_S,
        )
    except TimeoutError:
        logger.warning(
            "tier3_timeout",
            correlation_id=correlation_id,
            model_id=judge_model_id,
            timeout_s=JUDGE_TIMEOUT_S,
        )
        return _unavailable(started, "judge timed out")

    if not raw:
        # The client already logged the failure under this correlation id.
        return _unavailable(started, "judge unavailable")

    try:
        verdict = _JudgeVerdict.model_validate(raw)
    except ValidationError as exc:
        logger.warning(
            "tier3_invalid_verdict",
            correlation_id=correlation_id,
            model_id=judge_model_id,
            error_count=exc.error_count(),
        )
        return _unavailable(started, "judge returned an invalid verdict")

    return TierSignal(
        tier=TierName.tier3_llm_judge,
        flagged=verdict.flagged,
        attack_type=verdict.attack_type if verdict.flagged else None,
        confidence=verdict.confidence if verdict.flagged else 0.0,
        matched_rule=f"llm_judge:{judge_model_id}",
        latency_ms=_elapsed_ms(started),
        notes=verdict.reasoning[:_MAX_NOTES_CHARS],
    )
