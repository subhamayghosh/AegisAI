"""Pin ``frontend/src/constants.js`` to the backend enums.

The frontend keeps its own copy of ``SourceType``/``AttackType``/``Decision``
so dropdowns and the landing-page headline counts can render without an API
round trip. That copy is only safe while it matches this package, so assert the
two agree rather than trusting a convention. The landing page derives its
"11 source types / 9 attack types" figures from these lists, so drift here
would silently publish a wrong number.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from aegisai.schemas import AttackType, Decision, SourceType

_CONSTANTS = Path(__file__).resolve().parents[3] / "frontend" / "src" / "constants.js"


def _js_source() -> str:
    if not _CONSTANTS.is_file():
        pytest.skip(f"frontend constants not present at {_CONSTANTS}")
    return _CONSTANTS.read_text(encoding="utf-8")


def _array_block(name: str, source: str) -> str:
    match = re.search(rf"export const {name} = \[(.*?)\n\];", source, re.S)
    assert match is not None, f"{name} not found in constants.js"
    return match.group(1)


def _values_of(name: str, source: str) -> list[str]:
    """Return the ``value:`` strings of an exported ``{value,label}`` array."""
    return re.findall(r'value:\s*"([^"]+)"', _array_block(name, source))


def test_source_types_match_backend_enum() -> None:
    assert _values_of("SOURCE_TYPES", _js_source()) == [e.value for e in SourceType]


def test_attack_types_match_backend_enum() -> None:
    assert _values_of("ATTACK_TYPES", _js_source()) == [e.value for e in AttackType]


def test_decisions_match_backend_enum() -> None:
    source = _js_source()
    match = re.search(r"export const DECISIONS = \[(.*?)\];", source, re.S)
    assert match is not None, "DECISIONS not found in constants.js"
    assert re.findall(r'"([^"]+)"', match.group(1)) == [d.value for d in Decision]
