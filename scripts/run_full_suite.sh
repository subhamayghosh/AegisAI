#!/usr/bin/env bash
# Bring up the backend and frontend dev server as
# background processes, then run every test layer in order:
#   1. backend pytest (unit + integration + e2e, with coverage)
#   2. the 100-case regression corpus against the live backend
#   3. frontend vitest
#
# Prints a pass/fail banner per stage and exits non-zero if any stage
# failed. Run from the repo root:
#
#   bash scripts/run_full_suite.sh
#
set -u -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKEND_HOST="127.0.0.1"
BACKEND_PORT="8000"
BACKEND_URL="http://${BACKEND_HOST}:${BACKEND_PORT}"
FRONTEND_PORT="3000"
FRONTEND_URL="http://${BACKEND_HOST}:${FRONTEND_PORT}"

# Prefer the project's virtual environment for local runs. CI intentionally
# falls back to its configured Python interpreter because it installs into the
# runner environment rather than creating backend/.venv.
if [ -x "$ROOT_DIR/backend/.venv/bin/python" ]; then
    BACKEND_PYTHON="$ROOT_DIR/backend/.venv/bin/python"
elif [ -x "$ROOT_DIR/backend/.venv/Scripts/python.exe" ]; then
    BACKEND_PYTHON="$ROOT_DIR/backend/.venv/Scripts/python.exe"
else
    BACKEND_PYTHON="python"
fi

BACKEND_PID=""
FRONTEND_PID=""

_cleanup() {
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null
    fi
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null
    fi
}
trap _cleanup EXIT

_wait_for_url() {
    local url="$1" tries=30
    while [ "$tries" -gt 0 ]; do
        if curl -fsS "$url" >/dev/null 2>&1; then
            return 0
        fi
        tries=$((tries - 1))
        sleep 1
    done
    return 1
}

echo "=== Starting backend (uvicorn on :${BACKEND_PORT}) ==="
(cd "$ROOT_DIR/backend" && "$BACKEND_PYTHON" -m uvicorn --app-dir src aegisai.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" \
    > "$ROOT_DIR/backend.full_suite.log" 2>&1) &
BACKEND_PID=$!

if ! _wait_for_url "$BACKEND_URL/health"; then
    echo "Backend did not become healthy in time. Log tail:"
    tail -n 50 "$ROOT_DIR/backend.full_suite.log" 2>/dev/null
    exit 1
fi
echo "Backend is healthy at ${BACKEND_URL}."

echo "=== Starting frontend dev server (Vite on :${FRONTEND_PORT}) ==="
(cd "$ROOT_DIR/frontend" && npm run dev -- --host "$BACKEND_HOST" --port "$FRONTEND_PORT" \
    > "$ROOT_DIR/frontend.full_suite.log" 2>&1) &
FRONTEND_PID=$!

if ! _wait_for_url "$FRONTEND_URL"; then
    echo "Frontend did not become ready in time. Log tail:"
    tail -n 50 "$ROOT_DIR/frontend.full_suite.log" 2>/dev/null
    exit 1
fi
echo "Frontend is ready at ${FRONTEND_URL}."

PYTEST_STATUS=0
CORPUS_STATUS=0
FRONTEND_TEST_STATUS=0

echo
echo "=== [1/3] Backend tests: pytest tests/unit/ tests/integration/ tests/e2e/ -v --cov ==="
(cd "$ROOT_DIR/backend" && "$BACKEND_PYTHON" -m pytest tests/unit/ tests/integration/ tests/e2e/ -v --cov)
PYTEST_STATUS=$?

echo
echo "=== [2/3] Regression corpus: python scripts/run_corpus.py ==="
AEGISAI_BASE_URL="$BACKEND_URL" "$BACKEND_PYTHON" "$ROOT_DIR/scripts/run_corpus.py" --base-url "$BACKEND_URL"
CORPUS_STATUS=$?

echo
echo "=== [3/3] Frontend tests: npm test -- --run ==="
(cd "$ROOT_DIR/frontend" && npm test -- --run)
FRONTEND_TEST_STATUS=$?

_cleanup
trap - EXIT

_result_line() {
    local name="$1" status="$2"
    if [ "$status" -eq 0 ]; then
        printf "  %-28s PASS\n" "$name"
    else
        printf "  %-28s FAIL (exit %s)\n" "$name" "$status"
    fi
}

echo
echo "############################################################"
echo "#                AEGISAI FULL SUITE RESULTS            #"
echo "############################################################"
_result_line "Backend pytest suite" "$PYTEST_STATUS"
_result_line "Regression corpus (>=95%)" "$CORPUS_STATUS"
_result_line "Frontend vitest suite" "$FRONTEND_TEST_STATUS"
echo "############################################################"

OVERALL=0
if [ "$PYTEST_STATUS" -ne 0 ] || [ "$CORPUS_STATUS" -ne 0 ] || [ "$FRONTEND_TEST_STATUS" -ne 0 ]; then
    echo "#                    OVERALL: FAIL                          #"
    OVERALL=1
else
    echo "#                    OVERALL: PASS                          #"
fi
echo "############################################################"

exit "$OVERALL"
