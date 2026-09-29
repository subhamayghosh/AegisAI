---
name: testing
description: Use when writing pytest unit/integration/e2e tests, Vitest frontend tests, mocking Anthropic API calls, or extending the master corpus regression suite.
---
# Testing

Use this skill for anything under `backend/tests/` or `frontend/tests/`. Covers the pytest layout (unit/, integration/, e2e/), `TestClient` fixtures with a per-test SQLite DB, mocking Anthropic calls with `respx` or `unittest.mock` so no real key is ever needed in CI, the `test_corpus/master.json` schema (100 cases across attack types, source types, and benign controls), the ≥95% corpus pass gate enforced in CI, and Vitest + React Testing Library conventions for the frontend. Read before adding a test file or a corpus case.
