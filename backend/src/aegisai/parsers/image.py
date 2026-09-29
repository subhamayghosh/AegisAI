from __future__ import annotations

import base64
from io import BytesIO

import pytesseract
from PIL import Image

from aegisai.schemas import ParsedInput, SourceType


def _to_bytes(content: bytes | str) -> bytes:
    if isinstance(content, bytes):
        return content
    return base64.b64decode(content)


def parse(content: bytes | str, source_type: SourceType, metadata: dict) -> ParsedInput:
    img = Image.open(BytesIO(_to_bytes(content)))
    text = pytesseract.image_to_string(img)

    meta = dict(metadata)
    meta["width"], meta["height"] = img.size
    return ParsedInput(text=text.strip(), source_type=source_type, metadata=meta)
