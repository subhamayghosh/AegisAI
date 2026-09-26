from __future__ import annotations

import base64
import binascii
import codecs
import html
import re
import time
import urllib.parse
from collections.abc import Callable

from promptshield.schemas import SourceType, TierName, TierSignal
from promptshield.tiers import tier1_heuristic

MAX_RECURSION_DEPTH = 3
_NON_PRINTABLE_RATIO_LIMIT = 0.30

_BASE64_RE = re.compile(r"(?<![A-Za-z0-9+/=])[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9+/=])")
_HEX_RE = re.compile(r"(?<![0-9a-fA-F])(?:[0-9a-fA-F]{2}){20,}(?![0-9a-fA-F])")
_URL_ENCODED_TOKEN_RE = re.compile(r"%[0-9A-Fa-f]{2}")
_UNICODE_ESCAPE_RE = re.compile(r"(?:\\u[0-9a-fA-F]{4}){3,}")
_HTML_ENTITY_RE = re.compile(r"(?:&#x?[0-9a-fA-F]+;|&[a-zA-Z]+;){3,}")


def _within_printable_limit(text: str) -> str | None:
    if not text:
        return None
    non_printable = sum(1 for ch in text if not (ch.isprintable() or ch in "\n\r\t"))
    if non_printable / len(text) >= _NON_PRINTABLE_RATIO_LIMIT:
        return None
    return text


def _bytes_to_text(raw: bytes) -> str | None:
    try:
        decoded = raw.decode("utf-8")
    except UnicodeDecodeError:
        return None
    return _within_printable_limit(decoded)


def _decode_base64(text: str) -> str | None:
    match = _BASE64_RE.search(text)
    if not match:
        return None
    candidate = match.group(0)
    padded = candidate + "=" * (-len(candidate) % 4)
    try:
        raw = base64.b64decode(padded, validate=False)
    except (binascii.Error, ValueError):
        return None
    return _bytes_to_text(raw)


def _decode_hex(text: str) -> str | None:
    match = _HEX_RE.search(text)
    if not match:
        return None
    try:
        raw = bytes.fromhex(match.group(0))
    except ValueError:
        return None
    return _bytes_to_text(raw)


def _decode_url(text: str) -> str | None:
    if len(_URL_ENCODED_TOKEN_RE.findall(text)) <= 5:
        return None
    decoded = urllib.parse.unquote(text)
    if decoded == text:
        return None
    return _within_printable_limit(decoded)


def _decode_rot13(text: str) -> str | None:
    if not any(ch.isalpha() for ch in text):
        return None
    decoded = codecs.decode(text, "rot_13")
    if decoded == text:
        return None
    return _within_printable_limit(decoded)


def _decode_unicode_escape(text: str) -> str | None:
    match = _UNICODE_ESCAPE_RE.search(text)
    if not match:
        return None
    try:
        decoded = match.group(0).encode("ascii").decode("unicode_escape")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return None
    return _within_printable_limit(decoded)


def _decode_html_entity(text: str) -> str | None:
    match = _HTML_ENTITY_RE.search(text)
    if not match:
        return None
    decoded = html.unescape(match.group(0))
    if decoded == match.group(0):
        return None
    return _within_printable_limit(decoded)


# Span-locating patterns for the encodings that decode a specific substring
# (as opposed to url/rot13, which transform the whole text) — reused by the
# sanitizer to redact exactly the matched span rather than the full text.
ENCODING_PATTERNS: dict[str, re.Pattern[str]] = {
    "base64": _BASE64_RE,
    "hex": _HEX_RE,
    "unicode_escape": _UNICODE_ESCAPE_RE,
    "html_entity": _HTML_ENTITY_RE,
}

# rot13 is its own inverse, so it is a leaf-only checker: recursing into it a
# second time would just reproduce the original text and fabricate a
# meaningless "encoded:rot13->encoded:rot13->..." chain.
_CHECKERS: tuple[tuple[str, Callable[[str], str | None], bool], ...] = (
    ("base64", _decode_base64, True),
    ("hex", _decode_hex, True),
    ("url", _decode_url, True),
    ("rot13", _decode_rot13, False),
    ("unicode_escape", _decode_unicode_escape, True),
    ("html_entity", _decode_html_entity, True),
)


async def detect(text: str, source_type: SourceType, *, _depth: int = 0) -> TierSignal:
    """Find encoded payloads, decode them, and rescan with Tier 1.

    Recurses up to ``MAX_RECURSION_DEPTH`` layers deep to catch doubly (or
    triply) encoded payloads such as base64-of-base64. ``matched_rule`` on a
    flagged result records the full decode chain, e.g.
    ``"encoded:base64->regex:ignore_previous_instructions"``.
    """
    started = time.perf_counter()

    best: TierSignal | None = None
    if _depth < MAX_RECURSION_DEPTH:
        for name, decoder, allow_recurse in _CHECKERS:
            decoded = decoder(text)
            if decoded is None:
                continue

            inner = await tier1_heuristic.detect(decoded, source_type)
            if not inner.flagged and allow_recurse and _depth + 1 < MAX_RECURSION_DEPTH:
                inner = await detect(decoded, source_type, _depth=_depth + 1)

            if inner.flagged and (best is None or inner.confidence > best.confidence):
                best = TierSignal(
                    tier=TierName.tier1_heuristic,
                    flagged=True,
                    attack_type=inner.attack_type,
                    confidence=inner.confidence,
                    matched_rule=f"encoded:{name}->{inner.matched_rule}",
                    latency_ms=0,
                )

    latency_ms = int(round((time.perf_counter() - started) * 1000))

    if best is None:
        return TierSignal(
            tier=TierName.tier1_heuristic,
            flagged=False,
            attack_type=None,
            confidence=0.0,
            matched_rule=None,
            latency_ms=latency_ms,
        )

    return best.model_copy(update={"latency_ms": latency_ms})
