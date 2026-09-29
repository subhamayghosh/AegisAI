# PromptShield

**PromptShield** is an agentic prompt-injection firewall built as a
production-grade full-stack application for the ET × Accenture AI Hackathon
(Problem 2 — target F3/D3).

## What is PromptShield

It inspects text destined for downstream LLM agents across three tiers
(regex heuristics, local embedding similarity, LLM judge) and returns an
`ALLOW / NEUTRALIZE / BLOCK` decision with per-tier signals, sanitized
output, and full auditability. It covers all 9 attack types (instruction
override, role change, secret extraction, tool abuse, credential theft,
context poisoning, multi-step jailbreak, encoded instructions, indirect
prompt injection) across all 11 input source types (user messages, web
pages, PDFs, emails, markdown, HTML, Word documents, API responses, OCR
text, source code, images) — see [§2 of the playbook](./PROMPTSHIELD_PLAYBOOK.md#2-hackathon-requirement-coverage-f1f3--d1d3)
for the full F3/D3 coverage claim and its evidence.

It ships as a real product, not a naked API: JWT auth, per-user inspection
history, a live metrics dashboard, per-user LLM model selection, session
suspicion tracking for multi-turn jailbreaks, and an admin audit log that
never stores raw inspected text.

## Screenshots

![PromptShield portal walkthrough](./docs/assets/portal-walkthrough.gif)

The short walkthrough shows the authenticated dashboard: a live decision
feed, per-decision colour coding, attack coverage, and session context. The
background artwork is intentionally behind opaque content panels so security
data stays readable.

## Use the portal

1. **Dashboard** is the live control room. It shows total, allowed,
   neutralized, and blocked inspections; the latest event feed; attack
   breakdown; and the most recent session score.
2. **Inspect** is the manual test console. Pick one of the 11 source types,
   paste content or upload PDF/DOCX/image, and read the decision plus every
   tier's signal. It can also reuse a Session ID and increment a turn number
   to demonstrate a multi-turn jailbreak.
3. **History** is the user's inspection record. Filter it, open any row for
   its reasoning and signals, delete an individual row, or reset your own
   history. Reset never deletes the separate hash-only audit log.
4. **Sessions** turns a repeated Session ID into a suspicion-score timeline.
5. **Settings** changes privacy preferences, detection thresholds, theme,
   and the permitted working/judge models.
6. **Admin users** see **Audit Log** in the account menu. It exposes global
   metrics/events and the privacy-safe audit records; ordinary users cannot
   open `/audit`.

For a guided hands-on tour, including safe fixtures and expected outcomes for
all 11 source types and all 9 attack families, use the
[`manual_test_cases`](./manual_test_cases/README.md) demo kit.

## Quickstart (Docker)

```bash
cp .env.example .env      # fill in ANTHROPIC_API_KEY at minimum
make up                   # docker-compose up --build — db, backend, frontend
# Backend  -> http://localhost:8000
# Frontend -> http://localhost:3000
# Postgres -> localhost:5432

make seed                 # seed an admin + demo user (see backend/.env / SEED_ADMIN_PASSWORD)
make logs                 # tail all three services
make down                 # stop and remove containers + the db volume
```

Equivalent raw compose commands (what the `Makefile` targets wrap) are in
[§19 of the playbook](./PROMPTSHIELD_PLAYBOOK.md#19-devops--docker--local-run).

### Local admin access

There is one login screen, not a separate unprotected admin portal. Seed the
demo users, then sign in as `admin@promptshield.dev` with the value of
`SEED_ADMIN_PASSWORD` in your untracked local `.env`. That value is
intentionally omitted from `.env.example`; choose a unique local credential
before any shared run. Open the account menu and select **Audit Log** (or
visit `/audit`). The seed script also creates a local non-admin demo account
for comparison.

## Local dev (no Docker)

On Windows, the quickest route is:

```powershell
.\START.ps1
# If the seeded admin cannot sign in, reset only that local account:
.\START.ps1 -ResetAdminPassword
# If you change the root .env and want to copy its non-database settings:
.\START.ps1 -SyncBackendEnv
```

The launcher migrates the local database, seeds the demo accounts, starts
FastAPI on `:8000` and Vite on `:3000`, then stops both and removes only
regenerable Vite/pytest caches when its PowerShell session ends. It never
removes your SQLite database, `.env`, uploads, or `node_modules`.

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# The image parser (backend/src/promptshield/parsers/image.py) shells out to
# the tesseract OCR binary via pytesseract — install it separately:
#   Debian/Ubuntu: apt-get install tesseract-ocr
#   macOS:         brew install tesseract
#   Windows:       https://github.com/UB-Mannheim/tesseract/wiki
# Without it, image-source-type inspections raise TesseractNotFoundError and
# the corresponding unit test (test_image_parser_ocr_extracts_injection_text)
# is skipped rather than failed.

# The Tier 2 semantic detector (backend/src/promptshield/tiers/tier2_semantic.py)
# downloads sentence-transformers/all-MiniLM-L6-v2 (~90MB) from Hugging Face
# on first import, then caches it under ~/.cache/huggingface — it needs
# network access to huggingface.co exactly once. On a machine/proxy that
# blocks that host, importing the module (and therefore
# tests/unit/tiers/test_tier2.py and scripts/tune_tier2_thresholds.py) fails.
cp ../.env.example ../.env         # fill in ANTHROPIC_API_KEY
alembic upgrade head
python ../scripts/seed_db.py
uvicorn promptshield.main:app --reload --port 8000

# 2. Frontend
cd ../frontend
npm install
npm run dev                        # http://localhost:3000
```

Testing (see [`.claude/skills/testing/SKILL.md`](./.claude/skills/testing/SKILL.md)):

```bash
cd backend  && python -m pytest tests/unit tests/integration tests/e2e -v --cov
cd frontend && npm test -- --run
python scripts/run_corpus.py           # 100-case regression corpus, needs the backend running
bash scripts/run_full_suite.sh         # all three, plus a pass/fail banner (CI runs this)
```

## Environment variables

All config is read from `.env` (see [`.env.example`](./.env.example)); nothing
is hard-coded. Full reference: [§17 of the playbook](./PROMPTSHIELD_PLAYBOOK.md#17-environment--configuration).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres in Docker/prod, SQLite for local dev |
| `JWT_SECRET` | HS256 signing key, min 32 chars — never commit a real one |
| `ACCESS_TOKEN_TTL_MIN` / `REFRESH_TOKEN_TTL_DAYS` | Token lifetimes |
| `ANTHROPIC_API_KEY` | Required for Tier 3 (LLM judge); Tiers 1+2 work without it |
| `CLAUDE_WORKING_MODEL` / `CLAUDE_JUDGE_MODEL` | App-default model IDs — overridable per-user from Settings |
| `TIER2_THRESHOLD` / `SESSION_JAILBREAK_THRESHOLD` | Detection thresholds |
| `RATE_LIMIT_LOGIN_PER_MIN` / `RATE_LIMIT_INSPECT_PER_MIN` | Per-IP / per-user rate limits |
| `CORS_ALLOWED_ORIGINS` | No wildcard, ever — see [security rules](./.claude/rules/security-rules.md) |
| `SEED_ADMIN_PASSWORD` | Used only by `scripts/seed_db.py` |

## How the pipeline works

Every inspection flows: rate limiter → parser (by source type) → Tier 1
regex + encoded-payload decoder → short-circuit on high confidence →
Tier 2 semantic embedding → Tier 3 LLM judge (with session context) →
session suspicion update → policy engine (`ALLOW` / `NEUTRALIZE` / `BLOCK`)
→ sanitizer → persisted to history + audit log (hash only by default).

Full architecture, the policy table, and the design decisions behind
short-circuiting and source-aware neutralization: [§4 of the playbook](./PROMPTSHIELD_PLAYBOOK.md#4-solution-architecture).
The demo narrative for the same pipeline: [`docs/DEMO_SCRIPT.md`](./docs/DEMO_SCRIPT.md).
Manual copy/paste and upload examples: [`manual_test_cases/README.md`](./manual_test_cases/README.md).

## Repository layout

- `backend/`     — FastAPI + SQLAlchemy + Alembic
- `frontend/`    — Vite + React 18 + Tailwind
- `.claude/`     — Claude Code skills, sub-agents, rules, memory
- `test_corpus/` — 100-case regression corpus
- `scripts/`     — corpus runner, full-suite runner, secret scanner
- `docker/`      — Dockerfiles + compose
- `docs/`        — architecture diagrams, demo script
- `manual_test_cases/` — safe Inspect fixtures and expected manual outcomes

## Contributing

This repo is built with Claude Code as a first-class collaborator — read
[`CLAUDE.md`](./CLAUDE.md) before making any change. It links to the full
playbook, the per-module skills under `.claude/skills/`, the sub-agents
under `.claude/agents/`, and the non-negotiable rules under
`.claude/rules/` (coding standards, security, git & secrets, prompt
etiquette). Every non-trivial change appends one line to
[`.claude/memory/progress.md`](./.claude/memory/progress.md).

## License

MIT — see [`LICENSE`](./LICENSE).
