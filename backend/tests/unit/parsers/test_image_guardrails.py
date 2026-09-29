from __future__ import annotations

from io import BytesIO
from types import SimpleNamespace

import pytest
from PIL import Image

from aegisai.parsers import image
from aegisai.schemas import SourceType


def _png_bytes(size: tuple[int, int] = (300, 120)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, "white").save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.mark.parametrize("message", ["Tesseract process timeout", "OCR timeout"])
def test_image_parser_surfaces_bounded_ocr_timeout(monkeypatch, message: str) -> None:
    monkeypatch.setattr(
        image,
        "get_settings",
        lambda: SimpleNamespace(ocr_timeout_s=1.0, ocr_max_dimension=4096),
    )

    def timed_out(*_args, **_kwargs):
        raise RuntimeError(message)

    monkeypatch.setattr(image.pytesseract, "image_to_string", timed_out)

    with pytest.raises(image.OCRTimeoutError):
        image.parse(_png_bytes(), SourceType.image, {})


def test_image_parser_downscales_before_ocr(monkeypatch) -> None:
    calls = []
    monkeypatch.setattr(
        image,
        "get_settings",
        lambda: SimpleNamespace(ocr_timeout_s=1.0, ocr_max_dimension=256),
    )

    def fake_ocr(img, **_kwargs):
        calls.append(img.size)
        return "synthetic OCR"

    monkeypatch.setattr(image.pytesseract, "image_to_string", fake_ocr)
    parsed = image.parse(_png_bytes((1200, 600)), SourceType.image, {})

    assert parsed.text == "synthetic OCR"
    assert parsed.metadata["width"] == 1200
    assert parsed.metadata["height"] == 600
    assert calls == [(256, 128)]