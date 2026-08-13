#!/usr/bin/env bash
# Runs the backend (uvicorn) and the frontend (next dev) together.
# Ctrl+C stops both.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="$ROOT/backend/.venv/bin/python"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"

if [ ! -x "$PYTHON" ]; then
  echo "Missing backend/.venv — run: bun run setup" >&2
  exit 1
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Missing frontend/node_modules — run: bun run setup" >&2
  exit 1
fi

pids=()

cleanup() {
  trap - INT TERM EXIT
  for pid in "${pids[@]}"; do
    # Kill the process and anything it spawned (uvicorn's reloader, next's workers).
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "==> api  http://localhost:$API_PORT   (docs: /docs)"
# `exec` replaces the subshell, so $! is the real uvicorn PID.
(cd "$ROOT/backend" && exec "$PYTHON" -m uvicorn app.main:app --reload --port "$API_PORT") &
pids+=($!)

echo "==> web  http://localhost:$WEB_PORT"
(cd "$ROOT/frontend" && exec bun run dev --port "$WEB_PORT") &
pids+=($!)

echo
wait
