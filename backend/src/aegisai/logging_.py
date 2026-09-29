from __future__ import annotations

import logging
import re
import sys

import structlog

_REDACT_RE = re.compile(r"password|token|api_key|authorization", re.IGNORECASE)


def _redact_processor(logger: object, method: str, event_dict: dict) -> dict:
    """structlog processor: replace sensitive key values with '***'."""
    return {k: "***" if _REDACT_RE.search(k) else v for k, v in event_dict.items()}


def configure_logging(log_level: str = "INFO") -> None:
    level = getattr(logging, log_level.upper(), logging.INFO)

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            _redact_processor,
            structlog.processors.JSONRenderer(),
        ],
        # stdlib-backed loggers: add_logger_name needs a `.name`, and the level
        # set by basicConfig below only filters when output goes through stdlib.
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
    )


def get_logger(name: str = __name__) -> structlog.BoundLogger:
    return structlog.get_logger(name)
