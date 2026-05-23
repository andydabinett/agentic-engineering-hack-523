#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "Starting fake correspondence server on :3001..."
CORRESPONDENCE_FAKE_DEMO=1 CORRESPONDENCE_DEV=1 npx tsx src/index.ts &
SERVER_PID=$!

sleep 2
echo "Starting Next.js dashboard..."
npm run web:dev
