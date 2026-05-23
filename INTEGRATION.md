# Repo integration map

All major pieces connect through **SQLite** (`data/listings.db`) as the source of truth for listings.

## Data flow

```
Nimble search/extract (+ Playwright fallback)
        ↓
  scripts/ingest-boroughs.js  →  SQLite (listings)
        ↓
  scripts/sync-clickhouse.js  →  ClickHouse (nyc_rent_ledger)
        ↓
  web/app/api/*               →  Next.js dashboard (Zustand)
```

## Commands

| Command | What it runs |
|---------|----------------|
| `npm run ingest` | Borough ingest → SQLite → auto ClickHouse sync |
| `npm run sync:clickhouse` | Push existing SQLite rows to ClickHouse |
| `npm run clickhouse:migrate` | Create `nyc_rent_ledger` table |
| `npm run verify` | Re-check listing URLs still live |
| `npm run web:dev` | Next.js UI at http://localhost:3000 |
| `npm run dev` | Pi coding agent TUI (`agent/`) |

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

The web app loads the **repo root** `.env` (not only `web/.env`).

## Chat agent

- `POST /api/chat` — streams from the pi agent in `agent/` (`src/bridge/chatAgent.js`)
- Requires `OPENROUTER_API_KEY` in repo root `.env`
- Tools: `update_criteria`, `ready_to_search` (drive onboarding UI)

## Not yet wired
- Senso, Google Calendar, x402 — PRD only
- Rent-stabilized CSV join — planned
