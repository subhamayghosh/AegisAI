---
name: backend-development
description: Use when working on FastAPI endpoints, Pydantic v2 schemas, dependency injection, async DB access, JWT auth wiring, or Alembic revisions under backend/src/promptshield/.
---
# Backend Development

Use this skill whenever you touch the FastAPI backend under `backend/src/promptshield/`. Covers project layout (api/, security/, db/, core/, tiers/, parsers/, llm/), async endpoint conventions, Pydantic v2 request/response models, dependency injection patterns (`get_db`, `get_current_user`, `require_admin`), JWT wiring, error handling with typed exceptions, Alembic revision workflow, and the rule that ORM objects never leave a route unwrapped — always return a Pydantic response model. Refer here before adding a new endpoint, module, or migration.
