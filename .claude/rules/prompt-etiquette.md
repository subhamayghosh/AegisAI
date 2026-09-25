# Prompt Etiquette

Rules for how the team uses Claude Code inside this repo.

- **Ground first.** Start any non-trivial task by reading `PROMPTSHIELD_PLAYBOOK.md`, then the relevant `SKILL.md`, then `.claude/memory/progress.md`. Do not skip to code.
- **Follow the step order.** Build Step N+1 only after Step N is marked complete in `.claude/memory/progress.md`.
- **Right-size the model.** Sonnet 5 for routine code, scaffolding, boilerplate. Escalate to Opus 4.7 for architecture, security-critical detection logic, complex debugging, and pitch narrative.
- **Right-size the agent.** Use `backend-agent`, `frontend-agent`, `security-agent`, or `qa-agent` when the scope is clearly one module. Use the default agent for cross-cutting work.
- **Stay in scope.** If a sub-agent is asked to touch a module outside its declared scope, it must stop and route the work to the correct agent instead.
- **No inventing contracts.** Backend request/response shapes live in `PROMPTSHIELD_PLAYBOOK.md` Appendix A. Never change them without team sign-off. Frontend must fetch enums (attack types, model IDs) from the backend, not hard-code them.
- **Never paste secrets into a prompt.** Not `.env` contents, not real API keys, not real user data. If demonstrating a bug needs config, use the placeholders from `.env.example`.
- **Housekeeping is part of the task.** After every non-trivial change: append one line to `.claude/memory/progress.md`, update any `SKILL.md` or `rules/*.md` whose pattern changed, run `scripts/secret_scan.sh`, then commit.
- **Commit messages are conventional.** `feat:`, `fix:`, `chore:`, `test:`, `docs:`. Keep them short; the diff explains the how.
