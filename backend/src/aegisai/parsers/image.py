from __future__ import annotations

import base64
from io import BytesIO

import pytesseract
from PIL import Image, ImageOps

from aegisai.config import get_settings
from aegisai.schemas import ParsedInput, SourceType


class OCRTimeoutError(RuntimeError):
    """Raised when the external OCR process exceeds its request budget."""


def _to_bytes(content: bytes | str) -> bytes:
    if isinstance(content, bytes):
        return content
    return base64.b64decode(content)


def parse(content: bytes | str, source_type: SourceType, metadata: dict) -> ParsedInput:
    settings = get_settings()
    with Image.open(BytesIO(_to_bytes(content))) as opened:
        img = ImageOps.exif_transpose(opened).convert("RGB")
        original_width, original_height = img.size
        max_dimension = max(256, settings.ocr_max_dimension)
        if max(img.size) > max_dimension:
            img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

        try:
            text = pytesseract.image_to_string(img, timeout=max(1.0, settings.ocr_timeout_s))
        except RuntimeError as exc:
            if "timeout" in str(exc).lower():
                raise OCRTimeoutError from exc
            raise

    meta = dict(metadata)
    meta["width"], meta["height"] = original_width, original_height
    meta["ocr_width"], meta["ocr_height"] = img.size
    return ParsedInput(text=text.strip(), source_type=source_type, metadata=meta)
