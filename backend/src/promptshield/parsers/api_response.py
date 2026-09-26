from __future__ import annotations

import json
from typing import Any

from promptshield.schemas import ParsedInput, SourceType


def _flatten(node: Any, prefix: str, lines: list[str]) -> None:
    if isinstance(node, dict):
        for key, value in node.items():
            _flatten(value, f"{prefix}{key}.", lines)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            _flatten(value, f"{prefix}{index}.", lines)
    else:
        lines.append(f"{prefix.rstrip('.')}: {node}")


def parse(
    content: bytes | str | dict[str, Any], source_type: SourceType, metadata: dict
) -> ParsedInput:
    """Accept a dict or a JSON string and flatten it to 'key: value' lines."""
    if isinstance(content, bytes):
        content = content.decode("utf-8", errors="replace")
    data = content if isinstance(content, dict | list) else json.loads(content)

    lines: list[str] = []
    _flatten(data, "", lines)
    return ParsedInput(text="\n".join(lines), source_type=source_type, metadata=dict(metadata))
