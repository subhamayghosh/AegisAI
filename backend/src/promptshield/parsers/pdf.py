from __future__ import annotations

import base64
from io import BytesIO

from pypdf import PdfReader

from promptshield.schemas import ParsedInput, SourceType


def _to_bytes(content: bytes | str) -> bytes:
    if isinstance(content, bytes):
        return content
    return base64.b64decode(content)


def parse(content: bytes | str, source_type: SourceType, metadata: dict) -> ParsedInput:
    reader = PdfReader(BytesIO(_to_bytes(content)))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    meta = dict(metadata)
    meta["page_count"] = len(reader.pages)
    return ParsedInput(text=text, source_type=source_type, metadata=meta)
