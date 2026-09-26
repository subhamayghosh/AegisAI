from __future__ import annotations

import re

from promptshield.schemas import ParsedInput, SourceType

_CODE_FENCE_RE = re.compile(r"```[a-zA-Z0-9]*\n?|```")
_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\([^)]*\)")
_LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)")
_HEADER_RE = re.compile(r"^\s{0,3}#{1,6}\s*", re.MULTILINE)
_EMPHASIS_RE = re.compile(r"(\*\*\*|\*\*|\*|___|__|_)(.+?)\1")
_BLOCKQUOTE_RE = re.compile(r"^\s{0,3}>\s?", re.MULTILINE)
_LIST_MARKER_RE = re.compile(r"^\s*(?:[-*+]|\d+\.)\s+", re.MULTILINE)


def _to_str(content: bytes | str) -> str:
    if isinstance(content, bytes):
        return content.decode("utf-8", errors="replace")
    return content


def _strip_markdown(raw: str) -> str:
    text = _CODE_FENCE_RE.sub("", raw)
    text = _IMAGE_RE.sub(r"\1", text)
    text = _LINK_RE.sub(r"\1", text)
    text = _HEADER_RE.sub("", text)
    text = _EMPHASIS_RE.sub(r"\2", text)
    text = _BLOCKQUOTE_RE.sub("", text)
    text = _LIST_MARKER_RE.sub("", text)
    text = text.replace("`", "")
    return text.strip()


def parse(content: bytes | str, source_type: SourceType, metadata: dict) -> ParsedInput:
    """Handle user_message, markdown, and ocr_text — plain-text sources."""
    raw = _to_str(content)
    text = _strip_markdown(raw) if source_type == SourceType.markdown else raw.strip()
    return ParsedInput(text=text, source_type=source_type, metadata=dict(metadata))
