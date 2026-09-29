---
name: testing
description: Use when writing pytest unit/integration/e2e tests, Vitest frontend tests, mocking Anthropic API calls, or extending the master corpus regression suite.
---
# Testing

Use this skill for anything under `backend/tests/` or `frontend/tests/`. Covers the pytest layout (unit/, integration/, e2e/), `TestClient` fixtures with a per-test SQLite DB, mocking Anthropic calls with `respx` or `unittest.mock` so no real key is ever needed in CI, the `test_corpus/master.json` schema (100 cases across attack types, source types, and benign controls), the ≥95% corpus pass gate enforced in CI, and Vitest + React Testing Library conventions for the frontend. Read before adding a test file or a corpus case.

## `tests/e2e/` conventions (Step 16)

- Reuse the `client`/`db` fixtures from `tests/conftest.py` (ASGITransport
  over a fresh in-memory SQLite DB) for every stateful scenario — that's
  already a "fresh server per test" in pytest-fixture terms, and Tier 2 is
  pre-stubbed benign by the autouse `_isolate_external_services` fixture.
  Only reach for `app.router.lifespan_context(app)` (no extra dependency
  needed — Starlette exposes it directly) when a test specifically needs
  startup/shutdown to run, e.g. `pipeline.warm_up()`.
- A long, multi-stage journey test (many scenarios in one session) can't
  rely on a strict `respx` `side_effect` list the way a short, isolated
  pipeline test can — one un-mocked branch shifts every later call's index.
  Route the mock by inspecting `json.loads(request.content)["messages"][0]["content"]`
  for a distinctive substring per scenario instead.
- When reusing an existing parser fixture (e.g. `tests/fixtures/*.pdf|.html`)
  for a new scenario, re-derive its parsed text first and check it against
  `tier1_heuristic.py`'s rules — a fixture built for a parser test (proving
  hidden content surfaces at all, via a Tier 1 flag) will often contain a
  0.95-confidence phrase that short-circuits straight to BLOCK, which is the
  wrong outcome for a scenario that wants to exercise NEUTRALIZE.

## Tier 2 model availability

`tests/unit/tiers/test_tier2.py` runs the real encoder only when
`AEGISAI_RUN_TIER2_MODEL_TESTS=1` is explicitly set and a complete local
Hugging Face snapshot is present. Ordinary/CI runs record one clear
module-level skip, instead of retrying a model download during collection.
That skip is an environment dependency, not evidence that the semantic tier
passed. Restore the machine's CA chain or pre-warm the model cache, then run
the opt-in suite before claiming live Tier 2 verification.
- Test clients use `httpx.AsyncClient` inside `app.router.lifespan_context(app)`
  so startup/shutdown behavior is exercised with each fresh SQLite test
  server. The autouse fixture stubs `pipeline.warm_up()` to prevent a Hugging
  Face download. Keep `anthropic<1` and `httpx` paired with `respx`; newer SDK
  transports bypass `respx` and make mocked judge tests call the network.

## Live/demo coverage

When changing Inspect, cover the scenario selector, paste/attachment mode, and the console in Vitest. For live readiness, run a small, explicitly named smoke set against the configured Anthropic judge with synthetic content only; never print the API key, raw user content, or response payloads that could contain sensitive text.
