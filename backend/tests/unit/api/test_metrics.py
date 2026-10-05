from __future__ import annotations

from aegisai.api.metrics import render_prometheus_metrics


def test_prometheus_metrics_are_privacy_safe_and_parseable() -> None:
    rendered = render_prometheus_metrics(
        {
            "total": 4,
            "allowed": 1,
            "neutralized": 2,
            "blocked": 1,
            "by_attack_type": {"indirect_prompt_injection": 2},
            "by_source_type": {"web_page": 2},
        }
    )

    assert "aegisai_inspections_total 4" in rendered
    assert 'decision="BLOCK"} 1' in rendered
    assert 'attack_type="indirect_prompt_injection"} 2' in rendered
    assert 'source_type="web_page"} 2' in rendered
    assert "input_hash" not in rendered
    assert "raw" not in rendered
