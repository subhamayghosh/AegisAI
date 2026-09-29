# AGENTS.md — PromptShield Repository Context

You are working on **PromptShield**, an agentic prompt-injection firewall
built as a production-grade full-stack application for the ET × Accenture
AI Hackathon (Problem 2 — target F3/D3).

## Read these before doing anything

1. `PROMPTSHIELD_PLAYBOOK.md` — the full playbook. Ground truth for scope,
   architecture, and step order.
2. `.Codex/rules/coding-standards.md`
3. `.Codex/rules/security-rules.md`
4. `.Codex/rules/git-and-secrets.md`
5. `.Codex/memory/progress.md` — what has already been built.

## Repository layout

- `backend/`  — FastAPI + SQLAlchemy + Alembic
- `frontend/` — Vite + React 18 + Tailwind
- `.Codex/`  — skills, sub-agent definitions, rules, memory
- `test_corpus/master.json` — 100-case regression corpus
- `scripts/` — corpus runner, full-suite runner, secret scanner

## Non-negotiables

- **Never** commit secrets. `.env` is `.gitignore`d. API keys, JWT secrets,
  and DB credentials come from `.env` only.
- **Never** store raw inspected text in the audit log. Use SHA-256 input
  hashes. Per-user history may store raw text only if the user has opted in
  via Settings.
- **Anthropic Codex only.** Working LLM: `Codex-sonnet-5`. Judge LLM:
  `Codex-opus-4-7`. Both are overridable from Settings and must be read
  from user settings before falling back to the app-default in `.env`.
- **Never** modify the JSON contract in `Appendix A` of the playbook
  without team sign-off — every tier depends on it.
- Follow the step order in `PROMPTSHIELD_PLAYBOOK.md` §13. Do not build
  Step N+1 before Step N is in `.Codex/memory/progress.md` as complete.

## Skills available

Read the relevant `SKILL.md` before working on a module:

- `.Codex/skills/backend-development/SKILL.md`
- `.Codex/skills/frontend-development/SKILL.md`
- `.Codex/skills/security-detection/SKILL.md`
- `.Codex/skills/testing/SKILL.md`
- `.Codex/skills/database/SKILL.md`

## Sub-agents available

For focused work, invoke a sub-agent using `.Codex/agents/<name>.md` as
the system context:

- `backend-agent`  — API endpoints, auth, DB
- `frontend-agent` — React pages, components
- `security-agent` — Tier 1/2/3 detection logic
- `qa-agent`       — unit / integration / e2e / corpus tests

## Model choice

- Use **Sonnet 5** (`Codex-sonnet-5`) for routine code generation,
  scaffolding, refactoring, and boilerplate.
- Escalate to **Opus 4.7** (`Codex-opus-4-7`) for: architecture reviews,
  security-critical detection logic, complex debugging, and pitch-deck
  writing.

## After every non-trivial change

1. Append a one-line entry to `.Codex/memory/progress.md`
   (`YYYY-MM-DD HH:MM  <author>  <what was done>`).
2. If the change alters an interface or introduces a new pattern, update
   the matching `SKILL.md` or `rules/*.md` file in the same commit.
3. Run `scripts/secret_scan.sh` before you commit.
