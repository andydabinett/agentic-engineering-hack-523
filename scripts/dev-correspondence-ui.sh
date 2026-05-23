#!/usr/bin/env bash
# Dashboard + ngrok on Next + Twilio webhook → full UI reach-out → Virtual Phone flow.
set -euo pipefail

cd "$(dirname "$0")/.."

WEB_PORT="${WEB_PORT:-3000}"
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
(
  cd web
  npm run dev -- -p "$WEB_PORT"
) &
WEB_PID=$!

echo "Waiting for Next.js..."
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${WEB_PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Starting ngrok tunnel to :${WEB_PORT}..."
ngrok http "$WEB_PORT" --log=stdout > /tmp/javier-ngrok-web.log 2>&1 &
NGROK_PID=$!

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
