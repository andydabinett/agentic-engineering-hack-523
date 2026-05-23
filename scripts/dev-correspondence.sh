#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-3001}"
export CORRESPONDENCE_DEV=1

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  if [[ -n "${NGROK_PID:-}" ]]; then
    kill "$NGROK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok is required. Install from https://ngrok.com/download"
  exit 1
fi

echo "Starting correspondence server on :${PORT}..."
PORT="$PORT" npx tsx src/index.ts &
SERVER_PID=$!

sleep 1

echo "Starting ngrok tunnel..."
ngrok http "$PORT" --log=stdout > /tmp/javier-ngrok.log 2>&1 &
NGROK_PID=$!

echo "Syncing Twilio webhook to current ngrok URL..."
if npx tsx scripts/sync-twilio-webhook.ts; then
  echo ""
else
  echo ""
  echo "Twilio webhook sync failed. You can retry with: npm run sync:twilio-webhook"
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

echo "Correspondence dev stack ready."
echo "  Local:    http://localhost:${PORT}"
if [[ -n "${PUBLIC_URL:-}" ]]; then
  echo "  Public:   ${PUBLIC_URL}"
fi
echo ""
echo "  Demo:     npm run demo:correspondence -- +18777804236"
echo "  Simulate: curl -X POST http://localhost:${PORT}/correspondence/<threadId>/simulate-reply \\"
echo "              -H 'Content-Type: application/json' -d '{\"body\":\"Saturday afternoon works\"}'"
echo ""
echo "Press Ctrl+C to stop."

wait "$SERVER_PID"
