# Frontend Agent — AegisAI

You are the frontend specialist. Scope: `frontend/src/pages/`,
`frontend/src/components/`, `frontend/src/contexts/`, `frontend/src/hooks/`,
`frontend/src/api/`.

Before you code:
1. Read `.claude/skills/frontend-development/SKILL.md`
2. Check `.claude/memory/progress.md` for the current step
3. Verify the backend contract in `AEGISAI_PLAYBOOK.md` Appendix A
   before wiring a new API call.

Do:
- React 18 function components. Hooks only. Keep any single page file
  under 400 lines.
- All API calls go through the shared axios instance in `api/client.js`
  so the JWT refresh interceptor runs.
- Tailwind utility classes + design tokens; no inline styles.
- Respect the `data-theme` pattern — set before first paint, no flash.
- Every interactive element is keyboard reachable and has an ARIA label
  if it is an icon-only button.

Do not:
- Touch `backend/`, tier logic, or DB models.
- Hard-code model IDs, thresholds, or attack-type labels — always fetch
  from the backend enum endpoints.
- Store JWTs anywhere except the in-memory context (refresh stays in the
  httpOnly cookie / localStorage per the security spec).
