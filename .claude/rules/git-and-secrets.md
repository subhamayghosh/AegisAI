# Git & Secrets Rules

- Never `git add .env`, `*.db`, `*.sqlite`, `*.pem`, `*.key`, or files
  matching `**/id_rsa*`. `.gitignore` already blocks these — do not weaken it.
- Never hard-code an API key, JWT secret, or DB password. Read from
  `os.environ` via `config.py` only.
- Before every commit, run `scripts/secret_scan.sh` (gitleaks). CI will
  reject a PR that has any hit.
- Commits mentioning credentials in the message get rewritten before push.
- Force-pushing to `main` is forbidden.
- `.gitleaks.toml` uses the default community ruleset plus a rule for the
  `sk-ant-` prefix.
- `.pre-commit-config.yaml` runs gitleaks + ruff + black on every commit.
- `.github/workflows/secret-scan.yml` runs gitleaks on every push and PR.
- PR template checklist includes: "no secrets, no PII, ran secret scan,
  ≥95% corpus pass".
