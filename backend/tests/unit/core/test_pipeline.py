from __future__ import annotations

import pytest

from aegisai.core import pipeline
from aegisai.schemas import SourceType, TierName, TierSignal


@pytest.mark.asyncio
async def test_tier2_load_failure_reports_actionable_unavailable_signal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FailedLoader:
        detect = None
        state = "failed"

        def start(self) -> None:
            raise AssertionError("a failed loader must not be started again")

    monkeypatch.setattr(pipeline, "_tier2", FailedLoader())

    signal = await pipeline._run_tier2("synthetic probe", SourceType.user_message)

    assert signal.matched_rule == "tier2_unavailable"
    assert signal.notes == (
        "semantic model unavailable; run scripts/prewarm_tier2.py "
        "or set TIER2_MODEL_PATH"
    )
    assert signal.flagged is False


@pytest.mark.asyncio
async def test_tier2_waits_for_background_loader_before_inspection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class ReadyLoader:
        detect = None
        state = "loading"

        def wait_until_ready(self, timeout_s: float) -> str:
            assert timeout_s >= 0.1

            async def _detect(text: str, source_type: SourceType) -> TierSignal:
                return TierSignal(
                    tier=TierName.tier2_semantic,
                    flagged=True,
                    confidence=0.91,
                    attack_type=None,
                )

            self.detect = _detect
            self.state = "ready"
            return self.state

    loader = ReadyLoader()
    monkeypatch.setattr(pipeline, "_tier2", loader)

    signal = await pipeline._run_tier2("synthetic probe", SourceType.user_message)

    assert signal.tier == TierName.tier2_semantic
    assert signal.flagged is True
    assert signal.confidence == 0.91
