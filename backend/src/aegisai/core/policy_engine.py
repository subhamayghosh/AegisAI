from __future__ import annotations

from aegisai.schemas import Decision, SourceType, TierSignal

# "Retrieved" sources per the architecture doc — content the caller didn't
# author themselves (PDFs, scraped HTML/web pages, upstream API responses).
_RETRIEVED_SOURCE_TYPES = frozenset(
    {SourceType.pdf, SourceType.html, SourceType.web_page, SourceType.api_response}
)

_HIGH_CONFIDENCE = 0.9
_STRONG_CONFIDENCE = 0.7
_MODERATE_CONFIDENCE = 0.5
_SESSION_BLOCK_THRESHOLD = 0.7


def _label(signal: TierSignal) -> str:
    return signal.attack_type.value if signal.attack_type else "unknown"


def decide(
    signals: list[TierSignal], session_score: float, source_type: SourceType
) -> tuple[Decision, str]:
    """Apply the v1 playbook §4 policy rules, in order, to a set of tier signals."""
    flagged = [s for s in signals if s.flagged]

    high_confidence = [s for s in flagged if s.confidence >= _HIGH_CONFIDENCE]
    if high_confidence:
        top = max(high_confidence, key=lambda s: s.confidence)
        return (
            Decision.BLOCK,
            f"{top.tier.value} high-confidence match on {_label(top)} "
            f"(confidence {top.confidence:.2f})",
        )

    strong = [s for s in flagged if s.confidence >= _STRONG_CONFIDENCE]
    if len(strong) >= 2:
        labels = ", ".join(sorted({_label(s) for s in strong}))
        return (
            Decision.BLOCK,
            f"{len(strong)} tiers independently flagged {labels}, each confidence >= 0.70",
        )

    if session_score >= _SESSION_BLOCK_THRESHOLD:
        return (
            Decision.BLOCK,
            f"session suspicion score {session_score:.2f} exceeds the block threshold",
        )

    # Any flagged signal that didn't already trigger BLOCK above is, by
    # construction, below 0.9 confidence — moderate-confidence signals in
    # [0.5, 0.9) get neutralized rather than blocked outright.
    moderate = [s for s in flagged if s.confidence >= _MODERATE_CONFIDENCE]
    if moderate:
        top = max(moderate, key=lambda s: s.confidence)
        return (
            Decision.NEUTRALIZE,
            f"{top.tier.value} flagged {_label(top)} at moderate confidence "
            f"({top.confidence:.2f})",
        )

    if source_type in _RETRIEVED_SOURCE_TYPES and flagged:
        return (
            Decision.NEUTRALIZE,
            f"retrieved content ({source_type.value}) carries a low-confidence flag; "
            "neutralizing as a precaution",
        )

    return Decision.ALLOW, "no tier flagged the input"
