from __future__ import annotations

import json
import uuid

import anthropic
import httpx

from aegisai.config import get_settings, resolve_model_ids
from aegisai.llm.prompts import (
    JUDGE_OUTPUT_SCHEMA,
    JUDGE_SYSTEM_PROMPT,
    build_judge_user_prompt,
)
from aegisai.logging_ import get_logger
from aegisai.schemas import SourceType

logger = get_logger(__name__)

# Thinking and reasoning share this budget on models that think; a verdict is
# ~60 tokens, so this leaves headroom without inviting long generations.
_JUDGE_MAX_TOKENS = 256


class AsyncAnthropicClient:
    """Thin wrapper over ``anthropic.AsyncAnthropic`` for the Tier 3 judge.

    ``classify`` never raises: every failure is logged with a correlation id
    and surfaces to the caller as an empty dict.
    """

    def __init__(
        self,
        api_key: str | None = None,
        *,
        timeout: float | None = None,
        max_retries: int | None = None,
    ) -> None:
        settings = get_settings()
        timeout_value = timeout if timeout is not None else float(settings.claude_timeout_s)
        # Desktop/corporate environments often set HTTP(S)_PROXY to a local
        # gateway that is unavailable to Python. The judge calls Anthropic
        # directly; an unreachable ambient proxy must not silently disable
        # Tier 3 while a normal TLS connection is available.
        self._http_client = httpx.AsyncClient(timeout=timeout_value, trust_env=False)
        self._client = anthropic.AsyncAnthropic(
            api_key=api_key or settings.anthropic_api_key or None,
            timeout=timeout_value,
            max_retries=max_retries if max_retries is not None else settings.claude_max_retries,
            http_client=self._http_client,
        )

    async def classify(
        self,
        text: str,
        source_type: SourceType,
        session_context: str | None,
        model_id: str | None,
        *,
        correlation_id: str | None = None,
    ) -> dict:
        correlation_id = correlation_id or uuid.uuid4().hex
        model_id = model_id or resolve_model_ids(None)[1]
        log = logger.bind(correlation_id=correlation_id, model_id=model_id)

        try:
            response = await self._client.messages.create(
                model=model_id,
                max_tokens=_JUDGE_MAX_TOKENS,
                system=JUDGE_SYSTEM_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": build_judge_user_prompt(text, source_type, session_context),
                    }
                ],
                # Low effort keeps the judge inside its 5s budget; the schema
                # makes the reply parseable without prose or code fences.
                output_config={
                    "effort": "low",
                    "format": {"type": "json_schema", "schema": JUDGE_OUTPUT_SCHEMA},
                },
            )
        except anthropic.APITimeoutError:
            log.warning("judge_call_timeout")
            return {}
        except anthropic.APIConnectionError:
            log.warning("judge_call_connection_error")
            return {}
        except anthropic.RateLimitError as exc:
            log.warning("judge_call_rate_limited", request_id=exc.request_id)
            return {}
        except anthropic.APIStatusError as exc:
            log.warning(
                "judge_call_api_error", status_code=exc.status_code, request_id=exc.request_id
            )
            return {}
        except Exception as exc:  # the contract is "never re-raise", so nothing escapes
            log.error("judge_call_unexpected_error", error_type=type(exc).__name__)
            return {}

        if response.stop_reason == "refusal":
            category = response.stop_details.category if response.stop_details else None
            log.warning("judge_call_refused", request_id=response._request_id, category=category)
            return {}

        raw = next((block.text for block in response.content if block.type == "text"), "")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            log.warning(
                "judge_response_malformed_json",
                request_id=response._request_id,
                stop_reason=response.stop_reason,
            )
            return {}

        if not isinstance(parsed, dict):
            log.warning("judge_response_not_an_object", request_id=response._request_id)
            return {}
        return parsed


_judge_client: AsyncAnthropicClient | None = None


def get_judge_client() -> AsyncAnthropicClient:
    """Process-wide client, built lazily so importing this module never needs a key."""
    global _judge_client
    if _judge_client is None:
        _judge_client = AsyncAnthropicClient()
    return _judge_client
