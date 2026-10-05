---
name: backend-development
description: Use when working on FastAPI endpoints, Pydantic v2 schemas, dependency injection, async DB access, JWT auth wiring, or Alembic revisions under backend/src/aegisai/.
---
# Backend Development

Use this skill whenever you touch the FastAPI backend under `backend/src/aegisai/`. Covers project layout (api/, security/, db/, core/, tiers/, parsers/, llm/), async endpoint conventions, Pydantic v2 request/response models, dependency injection patterns (`get_db`, `get_current_user`, `require_admin`), JWT wiring, error handling with typed exceptions, Alembic revision workflow, and the rule that ORM objects never leave a route unwrapped — always return a Pydantic response model. Refer here before adding a new endpoint, module, or migration.

## Parsers (`parsers/`)

`parsers.parse(content, source_type, metadata) -> ParsedInput` (schemas.py)
dispatches to one module per `SourceType`, each exposing the same
`parse(content: bytes | str, source_type: SourceType, metadata: dict) -> ParsedInput`
signature so the dispatcher stays a plain lookup table:

| source_type | module | notes |
|---|---|---|
| user_message, ocr_text | `text.py` | plain-text passthrough (strip only) |
| markdown | `text.py` | strips headers/emphasis/links/code fences/lists first |
| pdf | `pdf.py` | `pypdf` — extracts all text regardless of render visibility |
| email | `email.py` | stdlib `email.parser`; headers -> `metadata["headers"]`, body(ies) -> text |
| html, web_page | `html_.py` | BeautifulSoup `get_text()`; comments + `display:none`/`visibility:hidden` elements also surfaced into `metadata["hidden_content"]` *and* appended to `.text` (get_text() silently drops comments, so skipping this would hide payloads from every tier) |
| word_doc | `word.py` | `python-docx` — paragraphs then table cells |
| api_response | `api_response.py` | accepts a dict or a JSON string; flattens recursively to `"key.path: value"` lines |
| source_code | `source_code.py` | language-agnostic regex for `//`, `#`, `--` line comments, `/* */` block comments, and quoted string literals — `.text` is just those extracted pieces, not the raw source |
| image | `image.py` | `pytesseract` OCR; raises `TesseractNotFoundError` if the `tesseract` binary isn't on PATH (see root README) |

Binary source types (`pdf`, `word_doc`, `image`) accept either raw `bytes`
(tests) or a base64 `str` (the `FirewallRequest.text` wire format for binary
sources per Appendix A) — each module has its own tiny `_to_bytes` helper.

## Core pipeline (`core/`)

- `policy_engine.decide(signals, session_score, source_type) -> (Decision, reason)`
  applies the §4 rules **in order** — the first matching rule wins:
  1. any flagged signal with `confidence >= 0.9` -> BLOCK
  2. 2+ flagged signals each `confidence >= 0.7` -> BLOCK
  3. `session_score >= 0.7` -> BLOCK
  4. any remaining flagged signal with `confidence >= 0.5` -> NEUTRALIZE
  5. retrieved `source_type` (pdf/html/web_page/api_response) + any flag -> NEUTRALIZE
  6. else -> ALLOW

  Rule 4's "1 signal" in the playbook is read as "the highest-confidence
  signal still in [0.5, 0.9) once rules 1-3 didn't fire" — by construction
  nothing above 0.9 survives to this point, and a second signal below 0.5
  doesn't change the outcome, so this never conflicts with rule 5.

- `sanitizer.sanitize(text, signals, source_type) -> str` branches on the
  flagged signal's `matched_rule` prefix: `"encoded:..."` re-locates the
  original span via `encoded_detector.ENCODING_PATTERNS` and redacts it
  in place (whole-text transforms — url/rot13 — have no span, so the whole
  text is redacted instead); `"regex:..."` re-locates the match via
  `tier1_heuristic.pattern_for_rule()` and drops the enclosing sentence.
  Retrieved source types are then wrapped in `<untrusted_content>` with a
  fixed preamble, regardless of whether anything was flagged.

- `observability.py` is a module-level singleton (`threading.Lock`-guarded
  counters + a `deque(maxlen=100)` ring buffer) — `log_event()` is sync,
  `persist_audit_row(db, event)` is the async DB write. Call
  `observability.reset()` between tests; nothing else clears it.
  `AuditLog.metadata_` (Python attribute, `metadata` DB column — `metadata`
  is reserved by SQLAlchemy's declarative base) never holds raw text, only
  `attack_type` / `source_type` / `latency_ms`.

- `/admin/metrics`, `/admin/events`, `/admin/events?n=`, `/admin/audit`
  (paginated, filterable by `decision`/`event_type`) all sit behind
  `require_admin` in `api/admin.py`.

- `session_tracker.py` holds per-session suspicion scores in process memory
  (formula and escalation math in the security-detection skill).

- `pipeline.run_pipeline(request, user, db) -> FirewallResponse` is the only
  place the tiers are wired together (`POST /firewall/inspect` just calls it
  and maps `InputParseError` -> 422, `ParserUnavailableError` -> 503).
  Non-obvious rules it enforces:
  - `await db.refresh(user, attribute_names=["settings"])` up front — Tier 3
    and the raw-text opt-in need `user.settings`, and lazy loading raises
    under asyncio.
  - Parsers run in `asyncio.to_thread` (OCR / big PDFs would block the loop).
  - **Tier 2 never imports on the request path.** `_Tier2Loader` loads
    `tier2_semantic` (which loads its model at import) on a daemon thread,
    started by `main.py`'s lifespan via `pipeline.warm_up()`. The lifespan
    does not await model readiness, so auth and other non-inspection routes
    are available while a cold model loads. Until it's ready, inspection
    requests get an unflagged `matched_rule="tier2_unavailable"` signal.
    `import aegisai.main` must stay free of model loading.
  - Session scores and session context are keyed by **user + session_id**
    (`f"{user.id}:{session_id}"` in the tracker, `user_id` filter in SQL):
    `session_id` is client-supplied, so keying by it alone would let one
    user inflate or decay another's score.
  - `input_text` **and** `sanitized_text` are stored only when
    `store_raw_text_in_history` is on — the sanitized text is derived from
    the input. `input_hash` is SHA-256 of the raw `request.text`.
  - `persist_audit_row()` commits, which also commits the `Inspection` row
    added just before it (one transaction).
  - Logs `pipeline_over_latency_budget` when a request exceeds 2000 ms.
- `/history` and `/sessions` always filter by `user_id`; another user's
  inspection or session returns the same 404 as a missing one.
- A user may `DELETE /history` to clear only their Inspection rows or
  `DELETE /history/{inspection_id}` to clear one owned record. Neither route
  deletes audit rows (the audit log is a separate, hash-only compliance
  trail); both reset only the caller's in-memory session-score state.
- Tests: `tests/conftest.py` has an autouse `_isolate_external_services`
  fixture that stubs Tier 2 and activates `respx_mock`, so no test loads the
  embedding model or reaches Anthropic. An un-mocked judge call fails fast
  and becomes `tier3_unavailable`; add a respx route for
  `https://api.anthropic.com/v1/messages` when a test needs a verdict.

## Logging (`logging_.py`)

Get a logger with `get_logger(__name__)` and log structured key/values:
`logger.warning("judge_call_timeout", correlation_id=..., model_id=...)`.
structlog is routed through stdlib (`structlog.stdlib.LoggerFactory` +
`structlog.stdlib.BoundLogger`) so `add_logger_name` works and `LOG_LEVEL`
actually filters. The earlier `PrintLoggerFactory` setup raised
`AttributeError` on the first log call (the regression test is
`tests/unit/test_logging.py`). Keys matching `password|token|api_key|authorization`
are redacted to `***`. Never pass inspected text, emails, or IPs as values.
To assert on log output in tests, use pytest's `caplog` and `json.loads(record.getMessage())`
— not `structlog.testing.capture_logs()`, which misses any logger an earlier
test already cached (`cache_logger_on_first_use=True`), making it order-dependent.

## Bounded image OCR

The image parser uses `ImageOps.exif_transpose`, composites transparency onto white, converts to RGB, downsizes any image larger than `OCR_MAX_DIMENSION`, and passes `OCR_TIMEOUT_S` to Tesseract. A timeout is surfaced as HTTP 408 with an actionable message. If the Tesseract executable is missing and `OCR_VISION_FALLBACK=true`, the pipeline prepares a JPEG capped by `OCR_VISION_MAX_DIMENSION` and calls the configured Anthropic working model through `llm/image_ocr.py`, bounded by `OCR_VISION_TIMEOUT_S`. The OCR prompt treats every image instruction as untrusted text to transcribe; it never logs image bytes or extracted text. Keep local OCR work inside `asyncio.to_thread` so the event loop cannot be blocked.
## Protected demo gateway and metrics

The demo-only `/agent/chat` and `/agent/rag/query` routes call the same
`run_pipeline()` used by `/firewall/inspect` before returning a simulated
downstream response. A BLOCK is never forwarded; a NEUTRALIZE response only
forwards the sanitized boundary. Keep these routes clearly labelled as a
demonstration gateway rather than a production agent integration.

`GET /metrics` is a Prometheus-compatible, privacy-safe counter endpoint. It
may expose totals and enum labels, but must never include input hashes, raw
content, emails, IPs, or model secrets.

Session suspicion scores on the request path are loaded from the latest
user-scoped `inspections` row before policy evaluation. This keeps multi-turn
escalation consistent when the API runs with more than one worker; the
process-local tracker helpers remain only for unit/reset tests.
