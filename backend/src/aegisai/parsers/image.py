from __future__ import annotations

import base64
from io import BytesIO

import pytesseract
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from aegisai.config import get_settings
from aegisai.schemas import ParsedInput, SourceType


class OCRTimeoutError(RuntimeError):
    """Raised when the external OCR process exceeds its request budget."""


def _to_bytes(content: bytes | str) -> bytes:
    if isinstance(content, bytes):
        return content
    return base64.b64decode(content)


def _load_rgb_image(content: bytes | str) -> tuple[Image.Image, tuple[int, int]]:
    with Image.open(BytesIO(_to_bytes(content))) as opened:
        transposed = ImageOps.exif_transpose(opened)
        original_size = transposed.size
        if transposed.mode in {"RGBA", "LA"} or "transparency" in transposed.info:
            rgba = transposed.convert("RGBA")
            background = Image.new("RGBA", rgba.size, "white")
            image = Image.alpha_composite(background, rgba).convert("RGB")
        else:
            image = transposed.convert("RGB")
    return image, original_size


def _resize(image: Image.Image, max_dimension: int) -> None:
    limit = max(256, max_dimension)
    if max(image.size) > limit:
        image.thumbnail((limit, limit), Image.Resampling.LANCZOS)


def prepare_for_vision(
    content: bytes | str, metadata: dict
) -> tuple[str, str, dict]:
    """Return a bounded JPEG payload for the Claude Vision OCR fallback."""
    settings = get_settings()
    image, original_size = _load_rgb_image(content)
    _resize(image, min(settings.ocr_max_dimension, settings.ocr_vision_max_dimension))
    # Vision fallback must handle screenshots and scanned documents where the
    # attack is deliberately placed in a faint footnote, watermark, or small
    # annotation. Normalize contrast after resizing so those pixels survive
    # JPEG encoding and remain legible to the configured OCR model.
    image = ImageOps.autocontrast(image)
    image = ImageEnhance.Contrast(image).enhance(1.8)
    image = image.filter(ImageFilter.SHARPEN)

    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=90, optimize=True)
    prepared_metadata = dict(metadata)
    prepared_metadata["width"], prepared_metadata["height"] = original_size
    prepared_metadata["ocr_width"], prepared_metadata["ocr_height"] = image.size
    prepared_metadata["ocr_engine"] = "claude_vision"
    return base64.b64encode(buffer.getvalue()).decode("ascii"), "image/jpeg", prepared_metadata


def parse(content: bytes | str, source_type: SourceType, metadata: dict) -> ParsedInput:
    settings = get_settings()
    img, original_size = _load_rgb_image(content)
    _resize(img, settings.ocr_max_dimension)

    try:
        text = pytesseract.image_to_string(img, timeout=max(1.0, settings.ocr_timeout_s))
    except RuntimeError as exc:
        if "timeout" in str(exc).lower():
            raise OCRTimeoutError from exc
        raise

    meta = dict(metadata)
    meta["width"], meta["height"] = original_size
    meta["ocr_width"], meta["ocr_height"] = img.size
    meta["ocr_engine"] = "tesseract"
    return ParsedInput(text=text.strip(), source_type=source_type, metadata=meta)
