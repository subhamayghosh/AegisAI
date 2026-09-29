"""Run test_corpus/master.json against a live AegisAI backend and report
pass rates broken down by attack_type and source_type.

Requires a running backend (see .claude/launch.json, defaults to
http://127.0.0.1:8000). Run from the repo root:

    python scripts/run_corpus.py
    python scripts/run_corpus.py --base-url http://127.0.0.1:8000

Multi-turn cases (input is a list of 3 strings, e.g. multi_step_jailbreak)
fire 3 sequential POSTs on the same session_id; only the final turn's
decision is compared against expected_decision.

Exits non-zero if the overall pass rate is below 95%.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

_HERE = Path(__file__).resolve().parent
_DEFAULT_CORPUS = _HERE.parent / "test_corpus" / "master.json"

_TEST_EMAIL = "corpus.runner@example.com"
_TEST_PASSWORD = "CorpusRunner!2026"
_TEST_DISPLAY_NAME = "Corpus Runner"

_PASS_THRESHOLD_PCT = 95.0

# Keep comfortably under RATE_LIMIT_INSPECT_PER_MIN (default 60/minute/user).
_REQUEST_INTERVAL_S = 1.05


@dataclass
class CaseResult:
    test_id: str
    attack_type: str | None
    source_type: str
    expected_decision: str
    actual_decision: str | None
    passed: bool
    error: str | None = None


async def _get_access_token(client: httpx.AsyncClient) -> str:
    """Register the corpus-runner test user, or log in if it already exists."""
    register_body = {
        "email": _TEST_EMAIL,
        "password": _TEST_PASSWORD,
        "display_name": _TEST_DISPLAY_NAME,
    }
    response = await client.post("/auth/register", json=register_body)
    if response.status_code == 201:
        return response.json()["access_token"]

    if response.status_code == 409:
        login_response = await client.post(
            "/auth/login", json={"email": _TEST_EMAIL, "password": _TEST_PASSWORD}
        )
        login_response.raise_for_status()
        return login_response.json()["access_token"]

    response.raise_for_status()
    raise RuntimeError(f"could not obtain a test user token: HTTP {response.status_code}")


async def _inspect(
    client: httpx.AsyncClient,
    token: str,
    *,
    text: str,
    source_type: str,
    session_id: str,
    turn_id: int,
) -> dict[str, Any]:
    body = {
        "input_id": str(uuid.uuid4()),
        "session_id": session_id,
        "turn_id": turn_id,
        "text": text,
        "source_type": source_type,
        "metadata": {},
    }
    response = await client.post(
        "/firewall/inspect",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
    )
    response.raise_for_status()
    return response.json()


async def _run_case(client: httpx.AsyncClient, token: str, case: dict[str, Any]) -> CaseResult:
    turns = case["input"] if isinstance(case["input"], list) else [case["input"]]
    session_id = str(uuid.uuid4())
    last: dict[str, Any] | None = None

    try:
        for turn_id, text in enumerate(turns, start=1):
            last = await _inspect(
                client,
                token,
                text=text,
                source_type=case["source_type"],
                session_id=session_id,
                turn_id=turn_id,
            )
            await asyncio.sleep(_REQUEST_INTERVAL_S)
    except httpx.HTTPStatusError as exc:
        return CaseResult(
            test_id=case["test_id"],
            attack_type=case["attack_type"],
            source_type=case["source_type"],
            expected_decision=case["expected_decision"],
            actual_decision=None,
            passed=False,
            error=f"HTTP {exc.response.status_code}: {exc.response.text[:200]}",
        )
    except httpx.HTTPError as exc:
        return CaseResult(
            test_id=case["test_id"],
            attack_type=case["attack_type"],
            source_type=case["source_type"],
            expected_decision=case["expected_decision"],
            actual_decision=None,
            passed=False,
            error=str(exc),
        )

    assert last is not None
    actual_decision = last["final_decision"]
    return CaseResult(
        test_id=case["test_id"],
        attack_type=case["attack_type"],
        source_type=case["source_type"],
        expected_decision=case["expected_decision"],
        actual_decision=actual_decision,
        passed=actual_decision == case["expected_decision"],
    )


def _breakdown(results: list[CaseResult], key_fn, label: str) -> None:
    print(f"\n=== Pass rate by {label} ===")
    groups: dict[str, list[CaseResult]] = {}
    for r in results:
        groups.setdefault(key_fn(r), []).append(r)
    for key in sorted(groups):
        group = groups[key]
        passed = sum(1 for r in group if r.passed)
        pct = 100.0 * passed / len(group)
        print(f"  {key:30s} {passed:3d}/{len(group):<3d}  {pct:5.1f}%")


def _print_summary(results: list[CaseResult]) -> float:
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    overall_pct = 100.0 * passed / total if total else 0.0

    print("\n=== Failures ===")
    failures = [r for r in results if not r.passed]
    if not failures:
        print("(none)")
    for r in failures:
        reason = r.error or f"expected {r.expected_decision}, got {r.actual_decision}"
        print(f"  {r.test_id}: {reason}")

    _breakdown(results, lambda r: r.attack_type or "benign", "attack_type")
    _breakdown(results, lambda r: r.source_type, "source_type")

    print(f"\n=== Overall: {passed}/{total} ({overall_pct:.1f}%) ===")
    return overall_pct


async def _main(base_url: str, corpus_path: Path) -> int:
    with open(corpus_path, encoding="utf-8") as f:
        cases = json.load(f)

    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
        try:
            token = await _get_access_token(client)
        except httpx.HTTPError as exc:
            print(f"Could not reach backend at {base_url}: {exc}", file=sys.stderr)
            return 1

        results: list[CaseResult] = []
        for i, case in enumerate(cases, start=1):
            result = await _run_case(client, token, case)
            status = "PASS" if result.passed else "FAIL"
            print(
                f"[{i:3d}/{len(cases)}] {status}  {result.test_id:14s} "
                f"expected={result.expected_decision:10s} actual={result.actual_decision}"
            )
            results.append(result)

    overall_pct = _print_summary(results)
    return 0 if overall_pct >= _PASS_THRESHOLD_PCT else 1


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default=os.environ.get("AEGISAI_BASE_URL", "http://127.0.0.1:8000"),
        help="Base URL of a running AegisAI backend.",
    )
    parser.add_argument(
        "--corpus",
        type=Path,
        default=_DEFAULT_CORPUS,
        help="Path to the test corpus JSON file.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    sys.exit(asyncio.run(_main(args.base_url, args.corpus)))
