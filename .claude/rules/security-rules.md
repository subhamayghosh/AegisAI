# Security Rules

Non-negotiable. These rules override convenience, aesthetics, and velocity.

## Authentication

- Passwords are hashed with **bcrypt cost 12**. Never logged. Never returned in any response.
- JWTs are **HS256** signed with `JWT_SECRET` (min 32 chars, sourced from `.env`).
- Access token TTL 15 min. Refresh token TTL 7 days, single-use rotation.
- Rate limits via `slowapi`: `/auth/login` 5/min/IP, `/firewall/inspect` 60/min/user.
- Password reset in v1 always returns 202 to avoid user enumeration.
- `require_admin` dependency guards every `/admin/*` route.

## PII & content handling

- The **audit log never stores raw user text.** Only SHA-256 input hash + structured metadata.
- The per-user `inspections.input_text` column is `NULL` unless the user has opted in via Settings → Privacy.
- Raw text, email, and IP never appear in application logs. This is enforced by a redaction filter in `logging_.py` matching `/password|token|api_key|authorization/i`.
- Tier 2 embeddings run **locally** — no user text leaves the server for Tier 2. Tier 3 does send text to Anthropic; this is disclosed on the Inspect page.

## Secrets

- `ANTHROPIC_API_KEY`, `JWT_SECRET`, and DB credentials are loaded **once** at process start via `config.py`. Never printed, never returned in any response, redacted in error messages.
- The `sk-ant-` prefix has a dedicated gitleaks rule in `.gitleaks.toml`.

## Transport & CORS

- CORS allow-list from `.env` (`CORS_ALLOWED_ORIGINS`). No wildcard in any environment.
- Bearer tokens in `Authorization` header — no cookie-based session auth, so no CSRF surface. If refresh tokens are moved to `httpOnly` cookies later, add CSRF tokens at the same time.

## Dependencies

- `pip-audit` and `npm audit` run in CI. High/critical findings block merge.
