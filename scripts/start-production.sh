#!/usr/bin/env bash
# Web + optional background crawler (set CRAWLER_ENABLED=1).
set -euo pipefail
cd "$(dirname "$0")/.."

CRAWLER_PID=""
cleanup() {
  if [[ -n "${CRAWLER_PID}" ]] && kill -0 "${CRAWLER_PID}" 2>/dev/null; then
    echo "[start] stopping crawler (pid ${CRAWLER_PID})"
    kill -TERM "${CRAWLER_PID}" 2>/dev/null || true
    wait "${CRAWLER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [[ "${CRAWLER_ENABLED:-0}" == "1" ]]; then
  echo "[start] CRAWLER_ENABLED=1 — background ingest daemon"
  node scripts/crawl-daemon.js &
  CRAWLER_PID=$!
fi

echo "[start] Next.js on port ${PORT:-3000}"
exec npm run start:web
