from __future__ import annotations

from fastapi import APIRouter, Response

from aegisai.core.observability import get_metrics

router = APIRouter(tags=["meta"])


def _prometheus_name(value: str) -> str:
    return value.replace("-", "_").replace(".", "_")


def render_prometheus_metrics(metrics: dict) -> str:
    """Render privacy-safe counters for Prometheus-compatible scrapers."""
    lines = [
        "# HELP aegisai_inspections_total Total inspections processed.",
        "# TYPE aegisai_inspections_total counter",
        f"aegisai_inspections_total {metrics['total']}",
        "# HELP aegisai_inspections_by_decision_total Inspections by final decision.",
        "# TYPE aegisai_inspections_by_decision_total counter",
    ]
    decision_labels = {"allowed": "ALLOW", "neutralized": "NEUTRALIZE", "blocked": "BLOCK"}
    for decision in ("allowed", "neutralized", "blocked"):
        lines.append(
            f'aegisai_inspections_by_decision_total{{decision="{decision_labels[decision]}"}} '
            f"{metrics[decision]}"
        )

    lines.extend(
        [
            "# HELP aegisai_inspections_by_attack_type_total Inspections by attack type.",
            "# TYPE aegisai_inspections_by_attack_type_total counter",
        ]
    )
    for attack_type, count in sorted(metrics["by_attack_type"].items()):
        lines.append(
            "aegisai_inspections_by_attack_type_total"
            f'{{attack_type="{_prometheus_name(attack_type)}"}} {count}'
        )

    lines.extend(
        [
            "# HELP aegisai_inspections_by_source_type_total Inspections by source type.",
            "# TYPE aegisai_inspections_by_source_type_total counter",
        ]
    )
    for source_type, count in sorted(metrics["by_source_type"].items()):
        lines.append(
            "aegisai_inspections_by_source_type_total"
            f'{{source_type="{_prometheus_name(source_type)}"}} {count}'
        )
    return "\n".join(lines) + "\n"


@router.get("/metrics", include_in_schema=False)
async def metrics() -> Response:
    return Response(
        render_prometheus_metrics(get_metrics()),
        media_type="text/plain; version=0.0.4",
    )
