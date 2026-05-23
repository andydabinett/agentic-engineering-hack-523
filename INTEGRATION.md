# Repo integration map

All major pieces connect through **SQLite** (`data/listings.db`) as the source of truth for listings.

## Data flow

```
Nimble search/extract (+ Playwright fallback)
        ↓
  scripts/ingest-boroughs.js  →  SQLite (listings + photos_json URLs)
        ↓
  scripts/sync-clickhouse.js  →  ClickHouse (nyc_rent_ledger)
        ↓
  web/app/api/*               →  Next.js dashboard (Zustand)

Always-on (parallel):
  npm run crawler  →  ingest + verify + ClickHouse on a timer
  Docker/Railway: CRAWLER_ENABLED=1 via scripts/start-production.sh

Correspondence (parallel):
  npm run server  →  Hono API on PORT (default 3001) + Twilio SMS webhooks
        ↓
  POST /correspondence/start  →  autonomous outreach to lister phone
  GET /correspondence/:id     →  status + message timeline (frontend polls)
```

## Commands

| Command | What it runs |
|---------|----------------|
| `npm run ingest` | Borough ingest → SQLite → auto ClickHouse sync |
| `npm run sync:clickhouse` | Push existing SQLite rows to ClickHouse |
| `npm run clickhouse:migrate` | Create `nyc_rent_ledger` table |
| `npm run verify` | Re-check listing URLs still live |
| `npm run crawler` | Background ingest + verify loop (always-on) |
| `npm run crawler:once` | Single crawler cycle (smoke test) |
| `npm run web:dev` | Next.js UI at http://localhost:3000 |
| `npm run dev` | Pi coding agent TUI (`agent/`) |
| `npm run server` | Correspondence Hono server (`src/index.ts`, default port 3001) |
| `npm test` | Correspondence unit tests (vitest) |
| `npm run demo:correspondence -- +1…` | Start demo thread (Twilio Virtual Phone: `+18777804236`) |
| `npm run init:clickhouse` | Create correspondence tables (optional; in-memory fallback if unset) |

Skip ClickHouse on ingest: `node scripts/ingest-boroughs.js --no-clickhouse`

## Web API (live data)

| Route | Source |
|-------|--------|
| `GET /api/listings` | SQLite via `src/bridge/listingsApi.js` |
| `GET /api/listings/[id]` | Single row (`db-24` ids) |
| `GET /api/pipeline/stats` | `repository.stats()` |
| `POST /api/ingest` | Spawns `scripts/ingest-boroughs.js` |
| `GET /api/analytics/[id]` | ClickHouse borough median / delta |

Demo UI (mock listings): add `?demo=1` to any page.

## Environment

Copy `.env.example` → `.env` at **repo root**. The web server loads the same file when API routes import `src/config/env.js`.

Required for ingest: `NIMBLE_API_KEY`  
Required for analytics sync: `CLICKHOUSE_HOST` + `CLICKHOUSE_API_KEY` (the API key is the DB password)  
Required for live chat: `OPENROUTER_API_KEY`  
Required for SMS correspondence: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`  
Required for inbound SMS (local dev): `PUBLIC_BASE_URL` (ngrok HTTPS URL) + Twilio number webhook → `{PUBLIC_BASE_URL}/webhooks/twilio/sms`

The web app loads the **repo root** `.env` (not only `web/.env`).

## Correspondence API (Hono — `npm run server`)

Separate from the Next.js app. Default base URL: `http://localhost:3001` (auto-increments if port busy).

| Route | Purpose |
|-------|---------|
| `GET /health` | `{ twilioConfigured, clickhouseConfigured, calendarConfigured }` |
| `POST /correspondence/start` | Start thread: `{ listingId, listerPhone, listerName?, userId, listingSummary? }` |
| `GET /correspondence/:threadId` | Status, messages, `proposedViewingAt`, `calendarEventId` |
| `GET /correspondence?listingId=&userId=` | List threads |
| `POST /correspondence/:threadId/retry` | Retry failed thread |
| `POST /webhooks/twilio/sms` | Twilio inbound SMS (configure on your Twilio number) |
| `GET /auth/google` | Google Calendar OAuth (optional demo) |

**Status values** (poll every ~2s while active): `initiated` → `outreach_sent` → `awaiting_lister_reply` → `negotiating_time` → `viewing_proposed` → `viewing_confirmed` → `calendar_event_created` → `completed` (or `failed`).

**Local demo:** `ngrok http 3001` → set `PUBLIC_BASE_URL` → point Twilio Messaging webhook at `/webhooks/twilio/sms` → `npm run demo:correspondence -- +18777804236` (Twilio Virtual Phone).

Without `OPENROUTER_API_KEY`, a scripted agent handles the happy path. With it, pi-agent tools (`send_sms`, `check_calendar`, `book_viewing`) drive replies.

Persistence: ClickHouse when configured; otherwise in-memory (resets on server restart).

## Chat agent

- `POST /api/chat` — streams from the pi agent in `agent/` (`src/bridge/chatAgent.js`)
- Requires `OPENROUTER_API_KEY` in repo root `.env`
- Tools: `update_criteria`, `ready_to_search`, `scrape_listings` (on-demand Nimble ingest between crawler ticks)
- `GET /api/scrape/status` — poll while agent-triggered scrape runs

## Cloud hosting

See **[DEPLOY.md](DEPLOY.md)** — Railway (recommended), Render, or Vercel.

## Not yet wired

- Senso, x402 — PRD only
- Rent-stabilized CSV join — planned
- `web/app/messages` → correspondence API (frontend can poll `GET /correspondence/:id`)
- Google Calendar in production (OAuth routes exist; `GOOGLE_REFRESH_TOKEN` demo shortcut)
