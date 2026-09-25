# Coding Standards

## Python (backend)

- Python 3.11+. Type-hint every function signature. `from __future__ import annotations` at the top of every module.
- Format with `black` (line length 100). Lint with `ruff` (rules: E, F, I, B, UP, SIM).
- FastAPI endpoints are `async def` unless the underlying work is truly sync.
- Pydantic v2 for all request/response schemas. Never return raw ORM objects.
- Dependency injection for the DB session (`Depends(get_db)`) and current user (`Depends(get_current_user)`).
- Custom exception types for domain errors; convert to `HTTPException` at the API boundary.
- Never `print()`. Always use the configured logger from `logging_.py`.

## JavaScript/React (frontend)

- React 18 function components + hooks only. No class components.
- Keep any single page file under 400 lines; extract components once it grows past that.
- All API calls go through the shared axios instance so the JWT refresh interceptor runs.
- Tailwind utilities + design tokens; no inline styles, no ad-hoc CSS files unless truly global.
- Accessibility: keyboard reachable, ARIA labels on icon-only buttons, focus rings visible.

## General

- Small, focused commits. Conventional commit messages (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
- No commented-out code. Delete it — git remembers.
- No TODO without an owner and an issue link.
