# Cloud deployment

## Recommended: Railway (full stack)

Runs the **Next.js UI**, **SQLite** (persistent volume), **ingest API**, **OpenRouter chat**, and **ClickHouse sync**.

### 1. Push to GitHub

Ensure the repo is on GitHub (you already have `andydabinett/agentic-engineering-hack-523`).

### 2. Create a Railway project

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Select this repository.
3. Railway detects `Dockerfile` + `railway.toml` automatically.

### 3. Add a persistent volume

In the service → **Volumes** → **Add Volume**:

| Mount path   | Purpose              |
|-------------|----------------------|
| `/app/data` | SQLite `listings.db` |

Without this, listing data resets on every deploy.

### 4. Set environment variables

In **Variables**, add (same as local `.env`):

| Variable | Required |
|----------|----------|
| `NIMBLE_API_KEY` | Yes (ingest) |
| `OPENROUTER_API_KEY` | Yes (chat) |
| `CLICKHOUSE_HOST` | Yes (analytics + Vercel-style fallback reads) |
| `CLICKHOUSE_API_KEY` | Yes (password) |
| `CLICKHOUSE_PORT` | `8443` |
| `CLICKHOUSE_USER` | `default` |
| `CLICKHOUSE_DATABASE` | `default` |
| `CLICKHOUSE_SECURE` | `true` |

Optional (already set in Docker image):

| Variable | Value |
|----------|--------|
| `CLOUD_INGEST` | `1` (Nimble-only, no Playwright) |
| `CRAWLER_ENABLED` | `1` (default in Dockerfile — background ingest) |
| `CRAWLER_INGEST_INTERVAL` | `2m` (how often to pull new listings) |
| `CRAWLER_VERIFY_INTERVAL` | `1h` (re-check stale URLs) |
| `CRAWLER_MAX_RESULTS` | `5` per borough/source per cycle |
| `NODE_ENV` | `production` |

### 5. Deploy

Railway builds the Docker image and exposes a public URL like  
`https://javier-nyc-rent-production.up.railway.app`

Check health: `GET /api/health`

### 6. Seed data on first deploy

From your laptop (with `.env` filled in):

```bash
npm run clickhouse:migrate
npm run ingest -- --boroughs brooklyn --max-results 5
npm run sync:clickhouse
```

Or use **Start hunting** in the deployed UI (triggers `POST /api/ingest`).

---

## Alternative: Render

1. [render.com](https://render.com) → **New** → **Blueprint** → connect repo (`render.yaml` is included).
2. Set the same env vars in the dashboard.
3. The blueprint attaches a **1 GB disk** at `/app/data` for SQLite.

---

## Alternative: Vercel (UI + APIs only)

Good for a **demo URL**; SQLite does **not** persist on serverless.

1. Import repo in [vercel.com](https://vercel.com).
2. Set **Root Directory** to `web`.
3. Add the same environment variables (Vercel loads them into serverless functions).
4. Deploy.

`web/vercel.json` bundles `../src` into API routes. Listings come from **ClickHouse** if there is no local DB — run `npm run sync:clickhouse` from your machine after ingest.

Limitations on Vercel:

- Long ingest may hit the **60s** function limit (use Railway for heavy ingest).
- No Playwright fallback in cloud.

---

## Already in the cloud

| Service | Role |
|---------|------|
| **ClickHouse Cloud** | Analytics warehouse (`nyc_rent_ledger`) |
| **OpenRouter** | LLM for Javier chat |
| **Nimble** | Listing search & extract |

---

## Custom domain

- **Railway**: Service → **Settings** → **Networking** → add domain.
- **Vercel**: Project → **Domains**.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `/api/health` shows `sqlite: missing` on Railway | Attach volume at `/app/data` |
| ClickHouse errors | Add `CLICKHOUSE_HOST` + `CLICKHOUSE_API_KEY` |
| Chat 503 | Set `OPENROUTER_API_KEY` |
| Empty dashboard on Vercel | Run `npm run sync:clickhouse` locally after ingest |
