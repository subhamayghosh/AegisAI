from __future__ import annotations

import pytest

from promptshield.core.policy_engine import decide
from promptshield.schemas import AttackType, Decision, SourceType, TierName, TierSignal


def _sig(
    confidence: float,
    flagged: bool = True,
    attack_type: AttackType | None = AttackType.instruction_override,
    tier: TierName = TierName.tier1_heuristic,
) -> TierSignal:
    return TierSignal(
        tier=tier,
        flagged=flagged,
        attack_type=attack_type if flagged else None,
        confidence=confidence if flagged else 0.0,
        matched_rule="regex:ignore_previous_instructions" if flagged else None,
    )


# Eight-row truth table covering every branch of the §4 policy, in the order
# the rules are evaluated.
TRUTH_TABLE: list[tuple[str, list[TierSignal], float, SourceType, Decision]] = [
    (
        "single high-confidence signal blocks outright",
        [_sig(0.95)],
        0.0,
        SourceType.user_message,
        Decision.BLOCK,
    ),
    (
        "two signals each >= 0.7 block even though neither hits 0.9",
        [_sig(0.75), _sig(0.8, attack_type=AttackType.role_change)],
        0.0,
        SourceType.user_message,
        Decision.BLOCK,
    ),
    (
        "high session suspicion score blocks even with no flagged signal",
        [],
        0.8,
        SourceType.user_message,
        Decision.BLOCK,
    ),
    (
        "single moderate-confidence signal neutralizes",
        [_sig(0.6)],
        0.0,
        SourceType.user_message,
        Decision.NEUTRALIZE,
    ),
    (
        "retrieved source + a below-moderate flagged signal neutralizes",
        [_sig(0.3)],
        0.0,
        SourceType.pdf,
        Decision.NEUTRALIZE,
    ),
    (
        "nothing flagged, non-retrieved source, low session score allows",
        [],
        0.1,
        SourceType.user_message,
        Decision.ALLOW,
    ),
    (
        "nothing flagged allows even for a retrieved source type",
        [],
        0.0,
        SourceType.pdf,
        Decision.ALLOW,
    ),
    (
        "only one of two flagged signals clears 0.7, so it neutralizes rather than blocks",
        [_sig(0.75), _sig(0.4, attack_type=AttackType.role_change)],
        0.0,
        SourceType.user_message,
        Decision.NEUTRALIZE,
    ),
]


@pytest.mark.parametrize(
    "signals,session_score,source_type,expected",
    [row[1:] for row in TRUTH_TABLE],
    ids=[row[0] for row in TRUTH_TABLE],
)
def test_policy_truth_table(
    signals: list[TierSignal],
    session_score: float,
    source_type: SourceType,
    expected: Decision,
) -> None:
    decision, reason = decide(signals, session_score, source_type)

    assert decision == expected
    assert isinstance(reason, str) and reason
