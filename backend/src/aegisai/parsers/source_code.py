from __future__ import annotations

import re

from aegisai.schemas import ParsedInput, SourceType

# Language-agnostic: covers // and /* */ (C-family), # (Python/shell/Ruby),
# and -- (SQL/Lua) line/block comment styles.
_BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)
_LINE_COMMENT_RE = re.compile(r"(?://|#|--).*$", re.MULTILINE)
# Triple-quoted strings are matched first and removed before the single-quote
# pass. A Python docstring is the natural place to plant an instruction aimed
# at a coding assistant, and the single-quote pattern below would otherwise
# shred it into empty "" pairs and miss the body entirely.
_TRIPLE_STRING_RE = re.compile(r'""".*?"""|\'\'\'.*?\'\'\'', re.DOTALL)
_STRING_LITERAL_RE = re.compile(r"\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*'")


def _to_str(content: bytes | str) -> str:
    if isinstance(content, bytes):
        return content.decode("utf-8", errors="replace")
    return content


def parse(content: bytes | str, source_type: SourceType, metadata: dict) -> ParsedInput:
    raw = _to_str(content)

    triple_strings = [m.group(0) for m in _TRIPLE_STRING_RE.finditer(raw)]
    without_triples = _TRIPLE_STRING_RE.sub("", raw)

    comments = [m.group(0) for m in _BLOCK_COMMENT_RE.finditer(without_triples)]
    without_block_comments = _BLOCK_COMMENT_RE.sub("", without_triples)
    comments += [m.group(0) for m in _LINE_COMMENT_RE.finditer(without_block_comments)]
    strings = triple_strings + [
        m.group(0) for m in _STRING_LITERAL_RE.finditer(without_triples)
    ]

    meta = dict(metadata)
    meta["comment_count"] = len(comments)
    meta["string_literal_count"] = len(strings)

    extracted = "\n".join(comments + strings)
    if extracted.strip():
        meta["inspected_span"] = "comments_and_strings"
        return ParsedInput(text=extracted, source_type=source_type, metadata=meta)

    # Nothing quoted or commented to narrow down to. Inspecting the empty
    # string would hand the detectors nothing and silently return ALLOW for
    # whatever the payload actually said, so fall back to the whole input.
    # Prose submitted under source_type=source_code lands here.
    meta["inspected_span"] = "full_text_fallback"
    return ParsedInput(text=raw.strip(), source_type=source_type, metadata=meta)
