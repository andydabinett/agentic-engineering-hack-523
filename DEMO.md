# Correspondence demo

End-to-end SMS demo: Javier autonomously texts a lister, negotiates a viewing time, and (optionally) books Google Calendar.

**API reference:** [INTEGRATION.md — Correspondence API](INTEGRATION.md#correspondence-api-hono--npm-run-server)

---

## Prerequisites

1. Copy env template and fill Twilio credentials:

```bash
cp .env.example .env
```

| Variable | Required | Notes |
|----------|----------|-------|
| `TWILIO_ACCOUNT_SID` | Yes | [Twilio Console](https://console.twilio.com/) |
| `TWILIO_AUTH_TOKEN` | Yes | |
| `TWILIO_PHONE_NUMBER` | Yes | Your Javier outbound number (E.164) |
| `PUBLIC_BASE_URL` | Yes | Keep as `http://localhost:3001` — do **not** set this to ngrok |
| `OPENROUTER_API_KEY` | No | Without it, a scripted agent runs the happy path |

2. Install [ngrok](https://ngrok.com/download) (for live inbound SMS).

3. For Twilio trial accounts, use the **Virtual Phone** (`+18777804236`) as the lister — trial numbers cannot SMS arbitrary real phones (error 30032).

---

## Quick start (recommended)

**Terminal 1** — server, ngrok, and Twilio webhook sync in one command:

```bash
npm run dev:correspondence
```

This starts the Hono server on `:3001`, opens an ngrok tunnel, runs `npm run sync:twilio-webhook`, and sets `CORRESPONDENCE_DEV=1`.

**Terminal 2** — start a demo thread:

```bash
npm run demo:correspondence -- +18777804236
```

The script prints a `threadId`. Open the [Twilio Virtual Phone](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming) and reply as the lister (e.g. *"Saturday afternoon works"*). Javier responds automatically.

Poll thread status:

```bash
curl http://localhost:3001/correspondence/<threadId>
```

---

## What happens

```
You run demo:correspondence
        ↓
POST /correspondence/start  →  Javier sends first SMS to lister
        ↓
Lister replies (Virtual Phone or real phone)
        ↓
Twilio POST /webhooks/twilio/sms  →  agent continues negotiation
        ↓
GET /correspondence/:id  →  frontend polls status + message timeline
        ↓
completed (or failed)
```

**Status progression:** `initiated` → `outreach_sent` → `awaiting_lister_reply` → `negotiating_time` → `viewing_proposed` → `viewing_confirmed` → `calendar_event_created` → `completed`

---

## Demo without ngrok (fake broker replies — recommended for UI demo)

Set in `.env`:

```bash
CORRESPONDENCE_FAKE_DEMO=1
CORRESPONDENCE_DEV=1
```

**Terminal 1** — correspondence server (FakeSms when Twilio unset):

```bash
npm run server:fake
```

**Terminal 2** — dashboard:

```bash
npm run web:dev
```

Then either:

- Click **Demo reach out** on a matched listing, or
- In chat: *"Text the broker on db-24"*

The UI **Messages** thread fills automatically with scripted broker replies (no Virtual Phone, no ngrok).

CLI-only script:

```bash
npm run demo:fake-correspondence -- demo-listing-1
```

---

## Demo without ngrok (manual simulate-reply)

Useful for backend development when you do not need real inbound SMS.

```bash
CORRESPONDENCE_DEV=1 npm run server
```

Start a thread (terminal 2):

```bash
npm run demo:correspondence -- +15551234567
```

Simulate the lister's reply:

```bash
curl -X POST http://localhost:3001/correspondence/<threadId>/simulate-reply \
  -H 'Content-Type: application/json' \
  -d '{"body":"Saturday afternoon works for me"}'
```

Repeat `simulate-reply` with follow-up messages to walk through the full state machine.

---

## Manual setup (step by step)

If you prefer separate terminals or `dev:correspondence` is not available:

```bash
# Terminal 1
npm run server

# Terminal 2
ngrok http 3001

# Terminal 3 — after ngrok is up (updates Twilio, not .env)
npm run sync:twilio-webhook

# Terminal 4
npm run demo:correspondence -- +18777804236
```

### ngrok URL rotation

Free ngrok gives a new URL every restart. You do **not** need to edit `.env`:

| What | Action |
|------|--------|
| Twilio webhook URL | `npm run sync:twilio-webhook` |
| Signature validation | Automatic via ngrok `X-Forwarded-Host` headers |
| `PUBLIC_BASE_URL` | Leave as `http://localhost:3001` |

After restarting ngrok only:

```bash
npm run sync:twilio-webhook
```

For a deployed server with a stable hostname:

```bash
npm run sync:twilio-webhook -- --url https://your-app.example.com
```

---

## Twilio console checklist

One-time setup (webhook sync handles updates after that):

1. **Phone number → Messaging** (not Voice): *A message comes in* → webhook URL  
   Or run `npm run sync:twilio-webhook` and skip manual edits.
2. Confirm outbound number matches `TWILIO_PHONE_NUMBER` in `.env`.
3. Trial account: use Virtual Phone `+18777804236` as lister, or verify recipient numbers under *Verified Caller IDs*.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `403 Invalid Twilio signature` | Run `npm run sync:twilio-webhook` after ngrok restart; confirm webhook is under **Messaging**, not Voice |
| SMS undelivered, error **30032** | Trial account — use Virtual Phone or verify the recipient number |
| `No active thread for sender` | Phone mismatch or stale thread; start a fresh demo with `demo:correspondence` |
| Virtual Phone shows old messages | Virtual Phone is global SMS history, not per-session — look for the latest Javier thread |
| `sync:twilio-webhook` fails | Ensure ngrok is running (`curl http://127.0.0.1:4040/api/tunnels`) and Twilio creds are set |
| Server on wrong port | Set `PORT=3001` and point ngrok at the same port |

Health check:

```bash
curl http://localhost:3001/health
```

Expect `{ "status": "ok", "twilioConfigured": true, ... }`.

---

## Optional: Google Calendar

1. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` in `.env`.
2. Visit `http://localhost:3001/auth/google?userId=demo-user` and complete OAuth.
3. Or set `GOOGLE_REFRESH_TOKEN` directly for a one-user demo shortcut.

---

## Chat integration

With `npm run web:dev` + `npm run dev:correspondence` + `OPENROUTER_API_KEY`:

1. Use chat to search/scrape listings.
2. Say *"Text the broker on db-24"* (or use **Reach out** on a matched listing card).
3. Chat calls `start_correspondence` → SMS thread starts → **Messages** updates live.

Requires `CORRESPONDENCE_API_URL=http://localhost:3001` in `.env`.

---

## Tests

```bash
npm test
```

Covers state machine, orchestrator, Twilio webhook signatures, ngrok helpers, and simulate-reply.
