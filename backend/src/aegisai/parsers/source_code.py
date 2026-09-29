from __future__ import annotations

import re

from aegisai.schemas import ParsedInput, SourceType

# Language-agnostic: covers // and /* */ (C-family), # (Python/shell/Ruby),
# and -- (SQL/Lua) line/block comment styles.
_BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)
_LINE_COMMENT_RE = re.compile(r"(?://|#|--).*$", re.MULTILINE)
_STRING_LITERAL_RE = re.compile(r"\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*'")


def _to_str(content: bytes | str) -> str:
    if isinstance(content, bytes):
        return content.decode("utf-8", errors="replace")
    return content


def parse(content: bytes | str, source_type: SourceType, metadata: dict) -> ParsedInput:
    raw = _to_str(content)

    comments = [m.group(0) for m in _BLOCK_COMMENT_RE.finditer(raw)]
    without_block_comments = _BLOCK_COMMENT_RE.sub("", raw)
    comments += [m.group(0) for m in _LINE_COMMENT_RE.finditer(without_block_comments)]
    strings = [m.group(0) for m in _STRING_LITERAL_RE.finditer(raw)]

    meta = dict(metadata)
    meta["comment_count"] = len(comments)
    meta["string_literal_count"] = len(strings)
    return ParsedInput(text="\n".join(comments + strings), source_type=source_type, metadata=meta)
