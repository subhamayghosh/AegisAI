from __future__ import annotations

import re

from bs4 import BeautifulSoup, Comment

from aegisai.schemas import ParsedInput, SourceType

_HIDDEN_STYLE_RE = re.compile(r"display\s*:\s*none|visibility\s*:\s*hidden", re.IGNORECASE)


def _to_str(content: bytes | str) -> str:
    if isinstance(content, bytes):
        return content.decode("utf-8", errors="replace")
    return content


def _extract_hidden_content(soup: BeautifulSoup) -> list[str]:
    hidden: list[str] = []

    for comment in soup.find_all(string=lambda node: isinstance(node, Comment)):
        stripped = comment.strip()
        if stripped:
            hidden.append(stripped)

    for element in soup.find_all(style=True):
        if _HIDDEN_STYLE_RE.search(element["style"]):
            text = element.get_text(separator=" ", strip=True)
            if text:
                hidden.append(text)

    return hidden


def parse(content: bytes | str, source_type: SourceType, metadata: dict) -> ParsedInput:
    """Handle html and web_page — BeautifulSoup text extraction plus hidden content."""
    soup = BeautifulSoup(_to_str(content), "lxml")
    hidden_content = _extract_hidden_content(soup)

    text = soup.get_text(separator=" ", strip=True)
    # get_text() skips comment nodes, so surface them into the scanned text too —
    # otherwise a payload hidden in a comment would only ever reach the metadata.
    if hidden_content:
        text = "\n".join([text, *hidden_content])

    meta = dict(metadata)
    meta["hidden_content"] = hidden_content
    return ParsedInput(text=text, source_type=source_type, metadata=meta)
