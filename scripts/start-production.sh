#!/usr/bin/env bash
# Correspondence Hono + Next.js web + optional background crawler.
set -euo pipefail
cd "$(dirname "$0")/.."

CORRESPONDENCE_PORT="${CORRESPONDENCE_PORT:-3001}"
WEB_PORT="${WEB_PORT:-${PORT:-3000}}"
export CORRESPONDENCE_API_URL="${CORRESPONDENCE_API_URL:-http://127.0.0.1:${CORRESPONDENCE_PORT}}"

CORRESPONDENCE_PID=""
CRAWLER_PID=""

cleanup() {
  if [[ -n "${CORRESPONDENCE_PID}" ]] && kill -0 "${CORRESPONDENCE_PID}" 2>/dev/null; then
    echo "[start] stopping correspondence server (pid ${CORRESPONDENCE_PID})"
    kill -TERM "${CORRESPONDENCE_PID}" 2>/dev/null || true
    wait "${CORRESPONDENCE_PID}" 2>/dev/null || true
  fi
  if [[ -n "${CRAWLER_PID}" ]] && kill -0 "${CRAWLER_PID}" 2>/dev/null; then
    echo "[start] stopping crawler (pid ${CRAWLER_PID})"
    kill -TERM "${CRAWLER_PID}" 2>/dev/null || true
    wait "${CRAWLER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [[ "${CORRESPONDENCE_ENABLED:-1}" == "1" ]]; then
  echo "[start] Correspondence server on :${CORRESPONDENCE_PORT} (${CORRESPONDENCE_API_URL})"
  PORT="${CORRESPONDENCE_PORT}" npx tsx src/index.ts &
  CORRESPONDENCE_PID=$!
  sleep 1
fi

if [[ "${CRAWLER_ENABLED:-0}" == "1" ]]; then
  echo "[start] CRAWLER_ENABLED=1 — background ingest daemon"
  node scripts/crawl-daemon.js &
  CRAWLER_PID=$!
fi

echo "[start] Next.js on port ${WEB_PORT}"
export PORT="${WEB_PORT}"
exec npm run start:web
