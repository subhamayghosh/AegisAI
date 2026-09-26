from __future__ import annotations

from email import policy
from email.message import Message
from email.parser import BytesParser, Parser

from promptshield.schemas import ParsedInput, SourceType


def _extract_body(msg: Message) -> str:
    if not msg.is_multipart():
        payload = msg.get_content()
        return payload if isinstance(payload, str) else str(payload)

    parts: list[str] = []
    for part in msg.walk():
        if part.get_content_maintype() == "multipart":
            continue
        if part.get_content_disposition() == "attachment":
            continue
        if part.get_content_type() in ("text/plain", "text/html"):
            payload = part.get_content()
            parts.append(payload if isinstance(payload, str) else str(payload))
    return "\n".join(parts)


def parse(content: bytes | str, source_type: SourceType, metadata: dict) -> ParsedInput:
    if isinstance(content, bytes):
        msg = BytesParser(policy=policy.default).parsebytes(content)
    else:
        msg = Parser(policy=policy.default).parsestr(content)

    meta = dict(metadata)
    meta["headers"] = {key: str(value) for key, value in msg.items()}
    return ParsedInput(text=_extract_body(msg), source_type=source_type, metadata=meta)
