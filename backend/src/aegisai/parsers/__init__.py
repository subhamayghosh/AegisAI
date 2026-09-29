from __future__ import annotations

from collections.abc import Callable
from typing import Any

from aegisai.parsers import api_response as _api_response
from aegisai.parsers import email as _email
from aegisai.parsers import html_ as _html
from aegisai.parsers import image as _image
from aegisai.parsers import pdf as _pdf
from aegisai.parsers import source_code as _source_code
from aegisai.parsers import text as _text
from aegisai.parsers import word as _word
from aegisai.schemas import ParsedInput, SourceType

_Parser = Callable[[Any, SourceType, dict], ParsedInput]

_DISPATCH: dict[SourceType, _Parser] = {
    SourceType.user_message: _text.parse,
    SourceType.markdown: _text.parse,
    SourceType.ocr_text: _text.parse,
    SourceType.pdf: _pdf.parse,
    SourceType.email: _email.parse,
    SourceType.html: _html.parse,
    SourceType.web_page: _html.parse,
    SourceType.word_doc: _word.parse,
    SourceType.api_response: _api_response.parse,
    SourceType.source_code: _source_code.parse,
    SourceType.image: _image.parse,
}


def parse(content: bytes | str | dict, source_type: SourceType, metadata: dict) -> ParsedInput:
    """Dispatch *content* to the parser registered for *source_type*."""
    return _DISPATCH[source_type](content, source_type, metadata)
