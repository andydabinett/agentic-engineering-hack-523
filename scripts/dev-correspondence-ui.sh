#!/usr/bin/env bash
# Dashboard + ngrok on Next + Twilio webhook → full UI reach-out → Virtual Phone flow.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
  nvm use >/dev/null 2>&1 || true
fi

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$node_major" -lt 22 ]]; then
  echo "Node.js 22+ is required (ingest uses node:sqlite). Run: nvm install && nvm use"
  exit 1
fi

export CORRESPONDENCE_DEV=1
export CORRESPONDENCE_FAKE_DEMO=0

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok is required. Install from https://ngrok.com/download"
  exit 1
fi

if [[ -z "${TWILIO_ACCOUNT_SID:-}" || -z "${TWILIO_AUTH_TOKEN:-}" || -z "${TWILIO_PHONE_NUMBER:-}" ]]; then
  echo "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env"
  exit 1
fi

port_in_use() {
  lsof -i ":$1" -sTCP:LISTEN >/dev/null 2>&1
}

pick_web_port() {
  local port="${WEB_PORT:-3000}"
  local start="$port"
  local max_port=$((start + 100))

  while port_in_use "$port"; do
    if [[ "$port" -eq "$start" ]]; then
      echo "Port ${port} is in use — incrementing..." >&2
    fi
    port=$((port + 1))
    if [[ "$port" -gt "$max_port" ]]; then
      echo "No free port found between ${start} and ${max_port}." >&2
      exit 1
    fi
  done

  if [[ "$port" -ne "$start" ]]; then
    echo "Using port ${port}." >&2
  fi
  echo "$port"
}

WEB_PORT="$(pick_web_port)"
WEB_LOG="/tmp/javier-next-web.log"

cleanup() {
  if [[ -n "${WEB_PID:-}" ]]; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
  if [[ -n "${NGROK_PID:-}" ]]; then
    kill "$NGROK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "Starting Next.js dashboard on :${WEB_PORT} (correspondence in-process)..."
: > "$WEB_LOG"
(
  cd web
  npm run dev -- -p "$WEB_PORT"
) >>"$WEB_LOG" 2>&1 &
WEB_PID=$!

echo "Waiting for Next.js..."
ready=0
for _ in $(seq 1 90); do
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo ""
    echo "Next.js failed to start. Last log lines:"
    tail -20 "$WEB_LOG" || true
    exit 1
  fi

  if grep -q "EADDRINUSE" "$WEB_LOG" 2>/dev/null; then
    echo ""
    echo "Next.js could not bind to :${WEB_PORT}. Last log lines:"
    tail -20 "$WEB_LOG" || true
    exit 1
  fi

  if curl -fsS "http://127.0.0.1:${WEB_PORT}/" >/dev/null 2>&1; then
    if grep -qE "Ready in|started server on|Local:" "$WEB_LOG" 2>/dev/null; then
      ready=1
      break
    fi
  fi
  sleep 1
done

if [[ "$ready" -ne 1 ]]; then
  echo ""
  echo "Timed out waiting for Next.js on :${WEB_PORT}. Last log lines:"
  tail -20 "$WEB_LOG" || true
  exit 1
fi

echo "Starting ngrok tunnel to :${WEB_PORT}..."
ngrok http "$WEB_PORT" --log=stdout > /tmp/javier-ngrok-web.log 2>&1 &
NGROK_PID=$!

sleep 2

echo "Syncing Twilio webhook to Next route (/api/webhooks/twilio/sms)..."
if npx tsx scripts/sync-twilio-webhook.ts --next; then
  echo ""
else
  echo ""
  echo "Twilio webhook sync failed. Retry: npm run sync:twilio-webhook -- --next"
  echo ""
fi

PUBLIC_URL="$(curl -fsS http://127.0.0.1:4040/api/tunnels | node -e "
  let input = '';
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    const data = JSON.parse(input);
    const tunnel = (data.tunnels || []).find((t) => t.proto === 'https') || (data.tunnels || [])[0];
    if (tunnel?.public_url) {
      console.log(tunnel.public_url.replace(/\\/$/, ''));
    }
  });
")"

echo "UI + live SMS stack ready."
echo "  Dashboard: http://localhost:${WEB_PORT}"
if [[ -n "${PUBLIC_URL:-}" ]]; then
  echo "  Public:    ${PUBLIC_URL}"
fi
echo ""
echo "  1. Open dashboard → matched listing → Reach out"
echo "     (dev mode uses DEMO_LISTER_PHONE=${DEMO_LISTER_PHONE:-+18777804236} when listing has no broker phone)"
echo "  2. Reply on Twilio Virtual Phone as the lister"
echo "  3. Watch Messages + Viewings update"
echo ""
echo "  Re-sync webhook after ngrok restart: npm run sync:twilio-webhook -- --next"
echo ""
echo "Press Ctrl+C to stop."

wait "$WEB_PID"
