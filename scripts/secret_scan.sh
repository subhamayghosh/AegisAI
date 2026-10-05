#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v gitleaks >/dev/null 2>&1; then
    echo "gitleaks is required for the secret scan but was not found on PATH." >&2
    exit 127
fi

gitleaks detect --source . --config .gitleaks.toml --redact --verbose
