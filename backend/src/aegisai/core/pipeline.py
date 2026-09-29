from __future__ import annotations

import asyncio
import hashlib
import threading
import time
import uuid
from collections.abc import Awaitable, Callable

import pytesseract
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegisai import parsers
from aegisai.config import resolve_model_ids
from aegisai.core import observability, policy_engine, sanitizer, session_tracker
from aegisai.db.models import Inspection, User
from aegisai.logging_ import get_logger
from aegisai.schemas import (
    AttackType,
    Decision,
    FirewallRequest,
    FirewallResponse,
    ParsedInput,
    SourceType,
    TierName,
    TierSignal,
)
from aegisai.tiers import encoded_detector, tier1_heuristic, tier3_llm_judge

logger = get_logger(__name__)

SHORT_CIRCUIT_CONFIDENCE = 0.95
_SESSION_CONTEXT_TURNS = 3
_LATENCY_BUDGET_MS = 2000

_Tier2Detect = Callable[[str, SourceType], Awaitable[TierSignal]]


class InputParseError(Exception):
    """The request body could not be parsed as its declared source_type."""


class ParserUnavailableError(Exception):
    """A parser's system dependency (e.g. the tesseract binary) is missing."""


class _Tier2Loader:
    """Loads Tier 2 off the request path.

    Importing ``tier2_semantic`` loads the embedding model at import time —
    seconds with a warm cache, minutes while the network retries. Doing that
    inside a request would stall the event loop, so it happens on a daemon
    thread and requests that arrive first get an unavailable Tier 2 signal.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._started = False
        self.detect: _Tier2Detect | None = None

    def start(self) -> None:
        with self._lock:
            if self._started:
                return
            self._started = True
        threading.Thread(target=self._load, name="tier2-loader", daemon=True).start()

    def _load(self) -> None:
        try:
            from aegisai.tiers import tier2_semantic
        except Exception as exc:  # model download / load failure; Tiers 1 + 3 still run
            logger.error("tier2_load_failed", error_type=type(exc).__name__)
            return
        self.detect = tier2_semantic.detect
        logger.info("tier2_ready")


_tier2 = _Tier2Loader()


def warm_up() -> None:
    """Start loading Tier 2 in the background. Call once at app startup."""
    _tier2.start()


def _tier2_unavailable(notes: str) -> TierSignal:
    return TierSignal(
        tier=TierName.tier2_semantic,
        flagged=False,
        matched_rule="tier2_unavailable",
        notes=notes,
    )


async def _run_tier2(text: str, source_type: SourceType) -> TierSignal:
    detect = _tier2.detect
    if detect is None:
        _tier2.start()
        return _tier2_unavailable("semantic model not loaded yet")
    try:
        return await detect(text, source_type)
    except Exception as exc:
        logger.error("tier2_detect_failed", error_type=type(exc).__name__)
        return _tier2_unavailable("semantic detector error")


async def _run_tier1(text: str, source_type: SourceType) -> list[TierSignal]:
    """Regex rulebook plus encoded-payload decode-and-rescan.

    The encoded signal is kept only when it flags: it is a separate finding
    (its own span for the sanitizer to redact), not a second opinion on the
    same text.
    """
    regex_signal = await tier1_heuristic.detect(text, source_type)
    encoded_signal = await encoded_detector.detect(text, source_type)
    return [regex_signal, encoded_signal] if encoded_signal.flagged else [regex_signal]


async def _parse(request: FirewallRequest) -> ParsedInput:
    metadata = request.metadata.model_dump(exclude_none=True)
    try:
        # Parsers are sync and some are slow (OCR, large PDFs) — keep them off
        # the event loop.
        return await asyncio.to_thread(parsers.parse, request.text, request.source_type, metadata)
    except pytesseract.TesseractNotFoundError as exc:
        raise ParserUnavailableError(request.source_type.value) from exc
    except Exception as exc:
        raise InputParseError(request.source_type.value) from exc


async def _session_context(
    db: AsyncSession, user_id: uuid.UUID, session_id: uuid.UUID, score: float
) -> str | None:
    """Summarise this user's last few turns in the session for the judge.

    Built from stored decisions and signal metadata only — never earlier
    turns' text, which is usually not stored and would otherwise be a second,
    undelimited injection channel into the judge prompt.
    """
    rows = (
        (
            await db.execute(
                select(Inspection)
                .where(Inspection.user_id == user_id, Inspection.session_id == session_id)
                .order_by(Inspection.created_at.desc())
                .limit(_SESSION_CONTEXT_TURNS)
            )
        )
        .scalars()
        .all()
    )
    if not rows:
        return None

    def _describe(signal: dict) -> str:
        attack = signal.get("attack_type") or "unknown"
        return f"{attack} ({signal['tier']}, confidence {signal['confidence']:.2f})"

    lines = [f"Previous {len(rows)} turn(s) in this session, oldest first:"]
    for row in reversed(rows):
        flagged = [s for s in row.tier_signals or [] if s.get("flagged")]
        detail = ", ".join(_describe(s) for s in flagged) if flagged else "nothing flagged"
        lines.append(f"- turn {row.turn_id}: {row.decision}; {detail}")
    lines.append(f"Session suspicion score before this turn: {score:.2f}")
    return "\n".join(lines)


def _top_attack_type(signals: list[TierSignal]) -> AttackType | None:
    flagged = [s for s in signals if s.flagged]
    return max(flagged, key=lambda s: s.confidence).attack_type if flagged else None


async def run_pipeline(request: FirewallRequest, user: User, db: AsyncSession) -> FirewallResponse:
    """Inspect one input end to end and persist the outcome.

    Raises InputParseError / ParserUnavailableError when the input can't be
    parsed; every tier failure after that degrades to an unflagged signal.
    """
    started = time.perf_counter()
    session_id = request.session_id or uuid.uuid4()
    source_type = request.source_type

    # get_current_user loads the user without settings; tier 3 and the privacy
    # opt-in both need them, and lazy loading is not allowed under asyncio.
    await db.refresh(user, attribute_names=["settings"])
    user_settings = user.settings
    working_model_id, judge_model_id = resolve_model_ids(user_settings)
    store_raw_text = bool(user_settings and user_settings.store_raw_text_in_history)

    parsed = await _parse(request)
    text = parsed.text

    # session_id is client-supplied, so scope it to the user — otherwise one
    # user could inflate or decay another user's session score.
    tracker_key = f"{user.id}:{session_id}"
    prior_score = session_tracker.get_score(tracker_key)

    signals = await _run_tier1(text, source_type)
    tier1_peak = max((s.confidence for s in signals if s.flagged), default=0.0)
    short_circuited = tier1_peak >= SHORT_CIRCUIT_CONFIDENCE
    if not short_circuited:
        signals.append(await _run_tier2(text, source_type))
        context = await _session_context(db, user.id, session_id, prior_score)
        signals.append(
            await tier3_llm_judge.detect(text, source_type, session_context=context, user=user)
        )

    session_score = session_tracker.update(tracker_key, signals)
    decision, reason = policy_engine.decide(signals, session_score, source_type)
    sanitized_text = (
        None if decision == Decision.BLOCK else sanitizer.sanitize(text, signals, source_type)
    )
    attack_type = _top_attack_type(signals)
    input_hash = hashlib.sha256(request.text.encode("utf-8")).hexdigest()
    latency_ms = int(round((time.perf_counter() - started) * 1000))

    db.add(
        Inspection(
            user_id=user.id,
            session_id=session_id,
            input_id=request.input_id,
            turn_id=request.turn_id,
            source_type=source_type.value,
            input_hash=input_hash,
            # The sanitized text is derived from the input, so it follows the
            # same opt-in as the input itself.
            input_text=request.text if store_raw_text else None,
            sanitized_text=sanitized_text if store_raw_text else None,
            decision=decision.value,
            attack_type=attack_type.value if attack_type else None,
            tier_signals=[s.model_dump(mode="json") for s in signals],
            session_suspicion_score=session_score,
            latency_ms=latency_ms,
            reason=reason,
            working_model_id=working_model_id,
            judge_model_id=judge_model_id,
        )
    )
    event = observability.log_event(
        input_hash=input_hash,
        decision=decision,
        attack_type=attack_type,
        source_type=source_type,
        latency_ms=latency_ms,
        user_id=str(user.id),
    )
    # persist_audit_row commits, which also commits the Inspection row above
    # in the same transaction.
    await observability.persist_audit_row(db, event)

    if latency_ms > _LATENCY_BUDGET_MS:
        logger.warning(
            "pipeline_over_latency_budget",
            latency_ms=latency_ms,
            budget_ms=_LATENCY_BUDGET_MS,
            short_circuited=short_circuited,
        )

    return FirewallResponse(
        input_id=request.input_id,
        session_id=session_id,
        turn_id=request.turn_id,
        final_decision=decision,
        sanitized_text=sanitized_text,
        tier_signals=signals,
        session_suspicion_score=session_score,
        reason=reason,
        working_model_id=working_model_id,
        judge_model_id=judge_model_id,
        latency_ms_total=latency_ms,
    )
