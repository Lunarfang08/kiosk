#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env — set DOGRAH_API_KEY before starting a call."
fi

export DATABASE_PATH="${DATABASE_PATH:-$ROOT/avatar_data/kiosk.db}"
export AVATAR_DATA_DIR="${AVATAR_DATA_DIR:-$ROOT/avatar_data}"

if [[ ! -x "$ROOT/backend/.venv/bin/uvicorn" ]]; then
  python3 -m venv "$ROOT/backend/.venv"
  "$ROOT/backend/.venv/bin/pip" install -r "$ROOT/backend/requirements.txt"
fi

if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
  (cd "$ROOT/frontend" && npm install)
fi

"$ROOT/backend/.venv/bin/uvicorn" app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000 &
BACK_PID=$!
trap 'kill $BACK_PID 2>/dev/null || true' EXIT

cd "$ROOT/frontend"
npm run dev -- --host 127.0.0.1 --port 5173
