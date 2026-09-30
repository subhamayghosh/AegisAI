from __future__ import annotations

import base64
import json
from pathlib import Path

from aegisai import parsers
from aegisai.parsers.image import prepare_for_vision
from aegisai.schemas import SourceType

FIXTURES = (
    Path(__file__).resolve().parents[4]
    / "manual_test_cases"
    / "complex_scenarios"
    / "fixtures"
)
BINARY_TYPES = {SourceType.pdf, SourceType.word_doc, SourceType.image}


def _manifest_cases() -> list[dict[str, str]]:
    return json.loads(FIXTURES.joinpath("manifest.json").read_text(encoding="utf-8"))["cases"]


def test_complex_pack_covers_every_source_type() -> None:
    cases = _manifest_cases()

    assert len(cases) == 11
    assert {SourceType(case["source_type"]) for case in cases} == set(SourceType)
    assert all(FIXTURES.joinpath(case["file"]).is_file() for case in cases)


def test_complex_pack_is_large_and_parseable() -> None:
    extracted: dict[SourceType, str] = {}
    for case in _manifest_cases():
        source_type = SourceType(case["source_type"])
        path = FIXTURES / case["file"]
        assert path.stat().st_size >= 3500

        if source_type == SourceType.image:
            encoded, media_type, metadata = prepare_for_vision(path.read_bytes(), {})
            assert media_type == "image/jpeg"
            assert len(base64.b64decode(encoded)) >= 10_000
            assert max(metadata["ocr_width"], metadata["ocr_height"]) <= 1568
            continue

        content: bytes | str = (
            path.read_bytes()
            if source_type in BINARY_TYPES
            else path.read_text(encoding="utf-8")
        )
        parsed = parsers.parse(content, source_type, {})
        assert len(parsed.text) >= 3000
        extracted[source_type] = parsed.text

    assert "WHITE PDF ANNEX" in extracted[SourceType.pdf]
    assert "HIDDEN EMAIL HTML" in extracted[SourceType.email]
    assert "HIDDEN DOM" in extracted[SourceType.html]
    assert "HIDDEN DOCX CELL" in extracted[SourceType.word_doc]
    assert "SCRAPER COMMENT" in extracted[SourceType.web_page]
