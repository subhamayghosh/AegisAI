"""Guard the regression corpus against malformed fixtures.

MAL_T2_006 once shipped prose under ``source_type: api_response``. That parser
calls ``json.loads()``, so the case returned HTTP 422 on every run and could
never pass at any detector quality — it silently capped the suite one case
below its own 95% gate. These tests make that class of mistake fail fast and
locally instead of showing up as a mysterious corpus regression.

Each check sweeps the whole corpus inside one test and aggregates every
offender into the failure message, rather than parametrising per case. The
suite-wide autouse fixture in ``tests/conftest.py`` installs ``respx_mock`` and
stubs Tier 2 for every test, which costs ~1.6s of setup each; parametrising
124 cases across several checks would add minutes to the suite for data
validation that needs none of that machinery.
"""

from __future__ import annotations

import base64
import json
from io import BytesIO
from pathlib import Path
from typing import Any

import pytest
from PIL import Image

from aegisai import parsers
from aegisai.schemas import AttackType, Decision, SourceType

_CORPUS_DIR = Path(__file__).resolve().parents[3] / "test_corpus"
_MASTER = _CORPUS_DIR / "master.json"


def _load(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        pytest.skip(f"corpus not present at {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _all_cases() -> list[tuple[str, dict[str, Any]]]:
    out: list[tuple[str, dict[str, Any]]] = []
    for path in sorted(_CORPUS_DIR.glob("*.json")):
        for case in _load(path):
            out.append((path.name, case))
    return out


def _turns(case: dict[str, Any]) -> list[str]:
    """A case's input is either one string or a list of multi-turn strings."""
    value = case["input"]
    return list(value) if isinstance(value, list) else [value]


def _report(problems: list[str], what: str) -> None:
    if problems:
        listed = "\n  - ".join(problems)
        pytest.fail(f"{len(problems)} {what}:\n  - {listed}")


def _image_problem(payload: str) -> str | None:
    """Validate an image fixture without shelling out to an OCR binary.

    ``parsers.parse`` for ``image`` calls Tesseract directly, but the pipeline
    wraps that in a bounded Claude Vision fallback, so a host without Tesseract
    still inspects images correctly. Invoking the parser here would test the
    host's OCR install rather than the fixture, and would block for
    OCR_TIMEOUT_S per case. What makes an image fixture valid is that the
    payload decodes to an image, so assert exactly that.
    """
    try:
        raw = base64.b64decode(payload, validate=True)
    except Exception as exc:  # noqa: BLE001
        return f"not valid base64: {type(exc).__name__}: {exc}"
    try:
        with Image.open(BytesIO(raw)) as img:
            img.verify()
    except Exception as exc:  # noqa: BLE001
        return f"does not decode as an image: {type(exc).__name__}: {exc}"
    return None


def test_corpus_is_non_empty() -> None:
    assert _load(_MASTER), "master.json must contain cases"


def test_every_case_parses_under_its_declared_source_type() -> None:
    """Every fixture must survive its own parser.

    This is the specific failure MAL_T2_006 hit: a case the pipeline rejects at
    the parsing stage is unpassable regardless of detection quality.
    """
    problems: list[str] = []
    for filename, case in _all_cases():
        source_type = SourceType(case["source_type"])
        for index, turn in enumerate(_turns(case)):
            where = f"{filename}:{case['test_id']} turn {index}"
            if source_type is SourceType.image:
                problem = _image_problem(turn)
                if problem:
                    problems.append(f"{where} {problem}")
                continue
            try:
                parsed = parsers.parse(turn, source_type, {})
            except Exception as exc:  # noqa: BLE001 - any parser error is a bad fixture
                problems.append(
                    f"{where} does not parse as '{source_type.value}': "
                    f"{type(exc).__name__}: {exc}"
                )
                continue
            if not parsed.text.strip():
                problems.append(
                    f"{where} parsed to empty text under '{source_type.value}' — "
                    "the detectors would see nothing"
                )
    _report(problems, "corpus cases do not survive their own parser")


def test_every_case_has_a_valid_schema() -> None:
    problems: list[str] = []
    required = {"test_id", "source_type", "input", "expected_decision"}
    for filename, case in _all_cases():
        where = f"{filename}:{case.get('test_id', '<missing id>')}"
        missing = required - set(case)
        if missing:
            problems.append(f"{where} is missing keys {sorted(missing)}")
            continue
        try:
            Decision(case["expected_decision"])
            SourceType(case["source_type"])
            if case.get("attack_type") is not None:
                AttackType(case["attack_type"])
        except ValueError as exc:
            problems.append(f"{where} has an invalid enum value: {exc}")
            continue
        if case.get("attack_type") is None and case["expected_decision"] != Decision.ALLOW.value:
            problems.append(
                f"{where} has no attack_type, so it is a benign control and must expect ALLOW"
            )
    _report(problems, "corpus cases have an invalid schema")


def test_test_ids_are_unique_across_corpus_files() -> None:
    seen: dict[str, str] = {}
    problems: list[str] = []
    for filename, case in _all_cases():
        tid = case["test_id"]
        if tid in seen:
            problems.append(f"{tid} appears in both {seen[tid]} and {filename}")
        seen[tid] = filename
    _report(problems, "duplicate test ids")


def test_master_covers_every_source_type() -> None:
    """D3 rests on heterogeneous input, so every source type needs evidence."""
    covered = {c["source_type"] for c in _load(_MASTER)}
    missing = {s.value for s in SourceType} - covered
    assert not missing, f"source types with no corpus case: {sorted(missing)}"


def test_master_covers_every_attack_type() -> None:
    """F3 claims all 9 attack types, so each needs at least one case."""
    covered = {c["attack_type"] for c in _load(_MASTER) if c.get("attack_type")}
    missing = {a.value for a in AttackType} - covered
    assert not missing, f"attack types with no corpus case: {sorted(missing)}"


def test_master_has_benign_controls_for_false_positive_measurement() -> None:
    benign = [c for c in _load(_MASTER) if c.get("attack_type") is None]
    assert len(benign) >= 20, (
        "too few benign controls to measure a false-positive rate credibly"
    )


def test_every_source_type_has_a_benign_control() -> None:
    """A per-source false-positive rate needs a benign case per source.

    Without this, a parser that mangles input into something that trips a rule
    would look like a detection win on that source type.
    """
    by_source: dict[str, bool] = {}
    for case in _load(_MASTER):
        source = case["source_type"]
        by_source[source] = by_source.get(source, False) or case.get("attack_type") is None
    missing = sorted(s for s, has_benign in by_source.items() if not has_benign)
    assert not missing, f"source types with no benign control: {missing}"
