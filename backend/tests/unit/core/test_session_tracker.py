from __future__ import annotations

import uuid

import pytest

from aegisai.core import session_tracker
from aegisai.core.policy_engine import decide
from aegisai.schemas import AttackType, Decision, SourceType, TierName, TierSignal


def _signal(confidence: float, flagged: bool = True) -> TierSignal:
    return TierSignal(
        tier=TierName.tier3_llm_judge,
        flagged=flagged,
        attack_type=AttackType.multi_step_jailbreak if flagged else None,
        confidence=confidence,
        matched_rule="llm_judge:claude-opus-4-7",
    )


def test_sustained_low_confidence_turns_escalate_to_block() -> None:
    session_id = uuid.uuid4()
    decisions: list[Decision] = []
    scores: list[float] = []

    for _ in range(6):
        signals = [_signal(0.4)]
        score = session_tracker.update(session_id, signals, Decision.ALLOW)
        decision, _ = decide(signals, score, SourceType.user_message)
        scores.append(score)
        decisions.append(decision)

    # Under this formula a steady 0.4 crosses 0.7 on turn 6:
    # 0.16, 0.30, 0.43, 0.55, 0.66, 0.75.
    assert scores[2] == pytest.approx(0.4336)
    assert scores[4] < 0.7 <= scores[5]
    # A lone 0.4 signal is below every per-turn threshold, so each early turn
    # is allowed on its own; only the accumulated session score blocks.
    assert decisions[:5] == [Decision.ALLOW] * 5
    assert decisions[5] == Decision.BLOCK


def test_score_decays_on_turns_with_no_flagged_signal() -> None:
    session_id = uuid.uuid4()
    session_tracker.update(session_id, [_signal(0.9)], Decision.NEUTRALIZE)
    previous = session_tracker.get_score(session_id)

    for _ in range(3):
        current = session_tracker.update(session_id, [], Decision.ALLOW)
        assert current == pytest.approx(previous * 0.9)
        previous = current


def test_unflagged_signals_do_not_raise_the_score() -> None:
    session_id = uuid.uuid4()

    score = session_tracker.update(session_id, [_signal(0.99, flagged=False)], Decision.ALLOW)

    assert score == 0.0


def test_score_is_capped_at_one() -> None:
    session_id = uuid.uuid4()

    for _ in range(10):
        score = session_tracker.update(session_id, [_signal(1.0)], Decision.BLOCK)

    assert score == 1.0


def test_independent_sessions_do_not_bleed() -> None:
    session_a, session_b = uuid.uuid4(), uuid.uuid4()

    session_tracker.update(session_a, [_signal(0.9)], Decision.BLOCK)

    assert session_tracker.get_score(session_a) > 0.0
    assert session_tracker.get_score(session_b) == 0.0


def test_reset_clears_only_that_session() -> None:
    session_a, session_b = uuid.uuid4(), uuid.uuid4()
    session_tracker.update(session_a, [_signal(0.9)], Decision.BLOCK)
    session_tracker.update(session_b, [_signal(0.9)], Decision.BLOCK)

    session_tracker.reset(session_a)

    assert session_tracker.get_score(session_a) == 0.0
    assert session_tracker.get_score(session_b) > 0.0


def test_str_and_uuid_session_ids_address_the_same_session() -> None:
    session_id = uuid.uuid4()

    session_tracker.update(session_id, [_signal(0.5)], Decision.ALLOW)

    assert session_tracker.get_score(str(session_id)) == pytest.approx(0.2)
