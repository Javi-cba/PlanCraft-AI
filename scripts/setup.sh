#!/usr/bin/env bash
# Installs the dependencies of both packages and seeds the .env files.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> frontend: bun install"
cd "$ROOT/frontend"
bun install

echo
echo "==> backend: virtualenv + pip"
cd "$ROOT/backend"

# Bun cannot install Python packages, so the backend keeps pip inside a venv.
if [ ! -d .venv ]; then
  echo "    creating .venv"
  python3 -m venv .venv
fi

.venv/bin/python -m pip install --upgrade pip --quiet
.venv/bin/pip install -r requirements.txt --quiet
echo "    dependencies installed"

echo
echo "==> env files"
seed_env() {
  local example="$1" target="$2"
  if [ ! -f "$example" ]; then
    return
  fi
  if [ -f "$target" ]; then
    echo "    $target already exists, left untouched"
  else
    cp "$example" "$target"
    echo "    created $target — fill in the values"
  fi
}

seed_env "$ROOT/backend/.env.example" "$ROOT/backend/.env"
seed_env "$ROOT/frontend/.env.example" "$ROOT/frontend/.env.local"

echo
echo "Done. Next step: bun run dev"
