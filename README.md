# PromptShield

**PromptShield** is an agentic prompt-injection firewall built as a
production-grade full-stack application for the ET × Accenture AI Hackathon
(Problem 2 — target F3/D3).

It inspects text destined for downstream LLM agents across three tiers
(regex heuristics, local embedding similarity, LLM judge) and returns an
`ALLOW / NEUTRALIZE / BLOCK` decision with per-tier signals, sanitized
output, and full auditability.

## Quickstart

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env         # fill in ANTHROPIC_API_KEY
alembic upgrade head
python ../scripts/seed_db.py
uvicorn promptshield.main:app --reload --port 8000

# 2. Frontend
cd ../frontend
npm install
npm run dev                        # http://localhost:3000
```

Or with Docker:

```bash
docker-compose -f docker/docker-compose.yml --env-file .env up --build
# Backend at :8000, frontend at :3000, postgres at :5432
```

## Repository layout

- `backend/`     — FastAPI + SQLAlchemy + Alembic
- `frontend/`   — Vite + React 18 + Tailwind
- `.claude/`    — Claude Code skills, sub-agents, rules, memory
- `test_corpus/` — 100-case regression corpus
- `scripts/`    — corpus runner, full-suite runner, secret scanner
- `docker/`     — Dockerfiles + compose
- `docs/`       — architecture diagrams, demo script

## Links

- Full playbook: [`PROMPTSHIELD_PLAYBOOK.md`](./PROMPTSHIELD_PLAYBOOK.md)
- Claude Code context: [`CLAUDE.md`](./CLAUDE.md)
- Coding standards: [`.claude/rules/coding-standards.md`](./.claude/rules/coding-standards.md)
- Security rules: [`.claude/rules/security-rules.md`](./.claude/rules/security-rules.md)
- Git & secrets rules: [`.claude/rules/git-and-secrets.md`](./.claude/rules/git-and-secrets.md)

## License

MIT — see [`LICENSE`](./LICENSE).
