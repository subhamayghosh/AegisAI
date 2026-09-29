from __future__ import annotations

import json
import logging

import pytest

from aegisai.logging_ import configure_logging, get_logger

_LOGGER_NAME = "aegisai.test_logging"


def test_configured_logger_emits_json_with_logger_name_and_redaction(
    caplog: pytest.LogCaptureFixture,
) -> None:
    configure_logging("INFO")

    with caplog.at_level(logging.INFO):
        get_logger(_LOGGER_NAME).warning(
            "probe_event", correlation_id="abc123", api_key="not-a-real-key"
        )

    messages = [r.getMessage() for r in caplog.records if r.name == _LOGGER_NAME]
    assert len(messages) == 1
    payload = json.loads(messages[0])
    assert payload["event"] == "probe_event"
    assert payload["logger"] == _LOGGER_NAME
    assert payload["correlation_id"] == "abc123"
    assert payload["api_key"] == "***"


def test_configured_level_filters_lower_severity(caplog: pytest.LogCaptureFixture) -> None:
    configure_logging("INFO")

    with caplog.at_level(logging.INFO):
        get_logger(_LOGGER_NAME).debug("too_quiet_to_emit")

    assert not [r for r in caplog.records if r.name == _LOGGER_NAME]
