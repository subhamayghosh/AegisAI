"""Run the synthetic all-source QA pack through the live authenticated API.

The runner deliberately records only safe QA metadata: decisions, tier summaries,
model ids, status codes, and timings. It never writes fixture text, judge
reasoning, access tokens, or sanitized content to the report.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import secrets
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx


BINARY_SOURCE_TYPES = {"pdf", "word_doc", "image"}


def _payload(path: Path, source_type: str) -> str:
    if source_type in BINARY_SOURCE_TYPES:
        return base64.b64encode(path.read_bytes()).decode("ascii")
    return path.read_text(encoding="utf-8")


def _safe_signal(signal: dict[str, Any]) -> dict[str, Any]:
    return {
        "tier": signal.get("tier"),
        "flagged": signal.get("flagged"),
        "attack_type": signal.get("attack_type"),
        "confidence": signal.get("confidence"),
        "matched_rule": signal.get("matched_rule"),
        "latency_ms": signal.get("latency_ms"),
    }


async def _register(client: httpx.AsyncClient) -> str:
    suffix = uuid.uuid4().hex
    response = await client.post(
        "/auth/register",
        json={
            "email": f"qa-{suffix}@example.com",
            "password": f"Qa-{secrets.token_urlsafe(18)}!",
            "display_name": "AegisAI Live QA",
        },
    )
    response.raise_for_status()
    return response.json()["access_token"]


async def _run_case(
    client: httpx.AsyncClient,
    token: str,
    fixture_dir: Path,
    case: dict[str, str],
) -> dict[str, Any]:
    source_type = case["source_type"]
    fixture = fixture_dir / case["file"]
    request_body = {
        "input_id": str(uuid.uuid4()),
        "session_id": str(uuid.uuid4()),
        "turn_id": 1,
        "text": _payload(fixture, source_type),
        "source_type": source_type,
        "metadata": {"filename": fixture.name},
    }
    started = time.perf_counter()
    try:
        response = await client.post(
            "/firewall/inspect",
            json=request_body,
            headers={"Authorization": f"Bearer {token}"},
        )
    except httpx.HTTPError as exc:
        return {
            "id": case["id"],
            "source_type": source_type,
            "fixture": fixture.name,
            "status_code": None,
            "passed": False,
            "error": str(exc),
            "wall_ms": round((time.perf_counter() - started) * 1000),
        }

    wall_ms = round((time.perf_counter() - started) * 1000)
    if response.status_code != 200:
        return {
            "id": case["id"],
            "source_type": source_type,
            "fixture": fixture.name,
            "status_code": response.status_code,
            "passed": False,
            "error": response.text[:240],
            "wall_ms": wall_ms,
        }

    result = response.json()
    signals = [_safe_signal(signal) for signal in result.get("tier_signals", [])]
    judge_ran = any(
        (signal.get("matched_rule") or "").startswith("llm_judge:") for signal in signals
    )
    short_circuited = not any(signal.get("tier") == "tier3_llm_judge" for signal in signals)
    final_decision = result.get("final_decision")
    passed = final_decision in {"BLOCK", "NEUTRALIZE"}
    return {
        "id": case["id"],
        "source_type": source_type,
        "fixture": fixture.name,
        "status_code": response.status_code,
        "passed": passed,
        "final_decision": final_decision,
        "reason": result.get("reason"),
        "session_suspicion_score": result.get("session_suspicion_score"),
        "working_model_id": result.get("working_model_id"),
        "judge_model_id": result.get("judge_model_id"),
        "latency_ms_total": result.get("latency_ms_total"),
        "wall_ms": wall_ms,
        "judge_ran": judge_ran,
        "short_circuited": short_circuited,
        "tier_signals": signals,
    }


async def _run(base_url: str, fixture_dir: Path, output: Path) -> int:
    manifest = json.loads((fixture_dir / "manifest.json").read_text(encoding="utf-8"))
    timeout = httpx.Timeout(90.0, connect=15.0)
    async with httpx.AsyncClient(base_url=base_url, timeout=timeout) as client:
        token = await _register(client)
        results = []
        for case in manifest["cases"]:
            results.append(await _run_case(client, token, fixture_dir, case))

    passed = sum(1 for result in results if result["passed"])
    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "base_url": base_url,
        "fixture_count": len(results),
        "passed": passed,
        "failed": len(results) - passed,
        "pass_rate_percent": round(100 * passed / len(results), 1) if results else 0.0,
        "pass_criterion": "Every malicious fixture must finish BLOCK or NEUTRALIZE; ALLOW is a failure.",
        "results": results,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    for result in results:
        status = "PASS" if result["passed"] else "FAIL"
        print(
            f"{status} {result['id']} {result['source_type']} "
            f"{result.get('final_decision', 'HTTP_ERROR')} "
            f"{result.get('latency_ms_total', result.get('wall_ms'))}ms"
        )
    print(f"SUMMARY {passed}/{len(results)} ({report['pass_rate_percent']}%)")
    return 0 if passed == len(results) else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--fixtures", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    return asyncio.run(_run(args.base_url, args.fixtures, args.output))


if __name__ == "__main__":
    raise SystemExit(main())
