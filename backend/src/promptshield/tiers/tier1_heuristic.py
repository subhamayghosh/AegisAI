from __future__ import annotations

import re
import time
from dataclasses import dataclass

from promptshield.schemas import AttackType, SourceType, TierName, TierSignal


@dataclass(frozen=True)
class _Rule:
    rule_id: str
    attack_type: AttackType
    pattern: re.Pattern[str]
    confidence: float


# Shared noun clusters so "ignore/disregard/override ... instructions" style
# phrases are recognized regardless of which synonym is used.
_INSTRUCTION_NOUNS = r"(?:instructions?|prompts?|rules?|directives?|guidelines?|programming)"

_RULES: tuple[_Rule, ...] = (
    # -- instruction_override ------------------------------------------------
    _Rule(
        "regex:ignore_previous_instructions",
        AttackType.instruction_override,
        re.compile(
            rf"\bignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier)\s+{_INSTRUCTION_NOUNS}\b",
            re.IGNORECASE,
        ),
        0.95,
    ),
    _Rule(
        "regex:disregard_prior_programming",
        AttackType.instruction_override,
        re.compile(
            rf"\b(?:disregard|forget|overwrite|override)\s+(?:all\s+)?(?:the\s+)?"
            rf"(?:(?:previous|prior|above|earlier|your)\s+){{1,2}}{_INSTRUCTION_NOUNS}\b",
            re.IGNORECASE,
        ),
        0.9,
    ),
    _Rule(
        "regex:from_now_on_override",
        AttackType.instruction_override,
        re.compile(
            r"\b(?:from now on|starting now)\s*,?\s*(?:you (?:must|will|shall)\b|ignore\b)",
            re.IGNORECASE,
        ),
        0.75,
    ),
    # -- role_change ----------------------------------------------------------
    _Rule(
        "regex:dan_jailbreak",
        AttackType.role_change,
        re.compile(
            r"\b(?:you are now|act as|become|pretend to be|i want you to act as)\s+"
            r"(?:dan\b|do anything now|an? unrestricted|an? unfiltered|a jailbroken)",
            re.IGNORECASE,
        ),
        0.9,
    ),
    _Rule(
        "regex:enable_developer_mode",
        AttackType.role_change,
        re.compile(r"\benable\s+developer\s+mode\b", re.IGNORECASE),
        0.85,
    ),
    _Rule(
        "regex:pretend_no_restrictions",
        AttackType.role_change,
        re.compile(
            r"\b(?:pretend|imagine|roleplay)\s+(?:that\s+)?you\s+"
            r"(?:have no|don't have any|are not bound by)\s+"
            r"(?:restrictions|rules|guidelines|filters)\b",
            re.IGNORECASE,
        ),
        0.85,
    ),
    # -- secret_extraction ------------------------------------------------------
    _Rule(
        "regex:reveal_system_prompt",
        AttackType.secret_extraction,
        re.compile(
            r"\b(?:reveal|show|print|output|display|leak)\s+(?:me\s+)?(?:your|the)\s+"
            r"(?:system prompt|internal instructions|hidden instructions|initial prompt)\b",
            re.IGNORECASE,
        ),
        0.92,
    ),
    _Rule(
        "regex:what_are_your_instructions",
        AttackType.secret_extraction,
        re.compile(
            r"\bwhat (?:are|were) your (?:system|initial|original)\s+"
            r"(?:instructions|prompt|directives)\b",
            re.IGNORECASE,
        ),
        0.85,
    ),
    _Rule(
        "regex:repeat_instructions_verbatim",
        AttackType.secret_extraction,
        re.compile(
            r"\brepeat\s+(?:the\s+)?(?:words|text|instructions)\s+above\s+verbatim\b",
            re.IGNORECASE,
        ),
        0.9,
    ),
    # -- tool_abuse -------------------------------------------------------------
    _Rule(
        "regex:tool_abuse_shell_command",
        AttackType.tool_abuse,
        re.compile(
            r"\b(?:execute|run)\s+(?:this\s+|the\s+)?(?:shell|bash|system)\s+command\b",
            re.IGNORECASE,
        ),
        0.85,
    ),
    _Rule(
        "regex:tool_abuse_admin_api",
        AttackType.tool_abuse,
        re.compile(r"\bcall\s+the\s+(?:admin|internal|privileged)\s+api\b", re.IGNORECASE),
        0.8,
    ),
    _Rule(
        "regex:tool_abuse_bulk_delete",
        AttackType.tool_abuse,
        re.compile(
            r"\b(?:delete|drop|remove)\s+(?:all|every)\s+(?:files?|records?|rows?|tables?|users?|databases?)\b",
            re.IGNORECASE,
        ),
        0.85,
    ),
    # -- credential_theft ---------------------------------------------------------
    _Rule(
        "regex:exfiltrate_credentials",
        AttackType.credential_theft,
        re.compile(
            r"\b(?:send|email|post|upload|exfiltrate)\s+(?:me\s+)?(?:the\s+)?"
            r"(?:password|api key|secret key|credentials|private key|ssh key)\b",
            re.IGNORECASE,
        ),
        0.9,
    ),
    _Rule(
        "regex:dump_dotenv",
        AttackType.credential_theft,
        re.compile(r"\b(?:cat|print|show|dump)\b[^.]{0,40}\.env\b", re.IGNORECASE),
        0.88,
    ),
    _Rule(
        "regex:aws_credential_keys",
        AttackType.credential_theft,
        re.compile(r"\baws_secret_access_key\b|\baws_access_key_id\b", re.IGNORECASE),
        0.85,
    ),
    # -- encoded_instructions -----------------------------------------------------
    _Rule(
        "regex:encoded_decode_and_comply",
        AttackType.encoded_instructions,
        re.compile(
            r"\b(?:decode|translate)\s+(?:this|the following)\s+(?:from\s+)?(?:base64|rot13|hex)\b"
            r"[^.]{0,60}\b(?:follow|obey|execute|comply|run)\b",
            re.IGNORECASE,
        ),
        0.88,
    ),
    _Rule(
        "regex:encoded_instructions_marker",
        AttackType.encoded_instructions,
        re.compile(r"\b(?:base64|rot13)\s*-?\s*encoded\s+instructions?\b", re.IGNORECASE),
        0.8,
    ),
)


def pattern_for_rule(rule_id: str) -> re.Pattern[str] | None:
    """Look up a rule's compiled pattern by its full id (e.g. "regex:...").

    Used by the sanitizer to re-locate a match's span for redaction without
    duplicating the rulebook.
    """
    return next((rule.pattern for rule in _RULES if rule.rule_id == rule_id), None)


async def detect(text: str, source_type: SourceType) -> TierSignal:
    """Scan *text* against the Tier 1 regex rulebook.

    ``source_type`` is accepted to satisfy the shared tier interface (and for
    future source-aware tuning) but does not currently change matching.
    """
    started = time.perf_counter()
    _ = source_type

    best: _Rule | None = None
    for rule in _RULES:
        if rule.pattern.search(text) and (best is None or rule.confidence > best.confidence):
            best = rule

    latency_ms = int(round((time.perf_counter() - started) * 1000))

    if best is None:
        return TierSignal(
            tier=TierName.tier1_heuristic,
            flagged=False,
            attack_type=None,
            confidence=0.0,
            matched_rule=None,
            latency_ms=latency_ms,
        )

    return TierSignal(
        tier=TierName.tier1_heuristic,
        flagged=True,
        attack_type=best.attack_type,
        confidence=best.confidence,
        matched_rule=best.rule_id,
        latency_ms=latency_ms,
    )
