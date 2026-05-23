# PRODUCT REQUIREMENT DOCUMENT & PARALLEL ROADMAP

## Project Title: Javier, the NYC Rent Concierge

**Subtitle:** An Autonomous Multi-Agent Lifecycle Swarm for Rent-Stabilized Ingestion, Geo-Analytics, and Automated Tenant Application Execution.

**Target Tracks:**

- **ClickHouse Track:** First Place ($1,000 Cash) – *"Impact in our community/World, improving lives"*
- **Nimble Track:** Best Use of Web Search Agents ($1,500 Cash/Credits Pool)
- **Senso.ai Track:** Content Generation Winner ($3,000 Credits)
- **Agent Payment Rails:** Coinbase CDP / x402 Architecture Integration

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem

Finding affordable housing in New York City is an administrative nightmare, especially when hunting for legally rent-stabilized apartments. These listings appear sporadically across fragmented open-web portals (**StreetEasy**, **Craigslist**). They are often unindexed by traditional search engines, under-marketed, and disappear within hours.

Furthermore, many landlords fail to explicitly advertise that a unit is rent-stabilized to avoid regulatory scrutiny, leaving tenants completely in the dark. Once a listing is discovered, the applicant faces immediate barriers: manually analyzing local pricing histories to verify if it's a genuine deal, drafting a fully compliant tenant dossier, submitting the application, and coordinating a live tour. For working-class New Yorkers, this manual loop is impossible to manage in real time.

### 1.2 The Solution

**Javier, the NYC Rent Concierge** is an end-to-end autonomous multi-agent application designed to level the playing field for tenants.

- **Discovers:** Javier uses **Nimble's Search & Extract APIs** to crawl **StreetEasy** and **Craigslist** across all **five NYC boroughs**. Listings are stored in a local **SQLite repository** (`data/listings.db`) and synced to **ClickHouse** for analytics. Cross-reference against NYC rent-stabilized building registries flags units landlords didn't advertise as stabilized.
- **Verifies:** A scheduled **verification task** re-fetches each stored URL via Nimble Extract and marks listings `active`, `expired`, or `unknown` so stale posts are purged from recommendations.
- **Evaluates:** Geospatial pricing data in **ClickHouse** runs real-time aggregations (price vs. neighborhood median, historical drops, price per sq ft). Listings significantly below a zip-code baseline are flagged high-priority.
- **Recommends:** Javier acts as a knowledgeable companion, powered by **Senso's Content Generation APIs**, answering tenant questions grounded in local housing laws, Good Cause Eviction rules, and NYC tenant rights.
- **Acts:** Checks **Google Calendar** for availability, **drafts** landlord inquiries (human approves before send — no automated in-app messaging on StreetEasy/Craigslist), pre-fills tenant application data, and books tour slots.

---

## 2. Core Architecture & Tech Stack

**Runtime:** Node.js 22+ (ES modules). No Python runtime in the core pipeline.

```
                  +-----------------------------------+
                  |   Frontend UI (Next.js / Vite)    | <--- Member 1 (planned)
                  +-----------------+-----------------+
                                    |
                                    ▼
                  +-----------------------------------+
                  |   Orchestration (Node workflows)  | <--- Member 2 (planned)
                  +--------+-----------------+--------+
                           |                 |
                           ▼                 ▼
+----------------------------+     +----------------------------+
|  Nimble Ingest + Verify    |     |      Senso.ai & Tools      | <--- Members 3 & 4
| SQLite + ClickHouse Core   |     |  (Calendar, Apps, RAG)     |
+----------------------------+     +----------------------------+
```

| Layer | Choice | Status | Rationale |
|-------|--------|--------|-----------|
| **Runtime** | Node.js 22+ (`type: module`) | Implemented | Single language for ingest, verify, ClickHouse, future API/UI |
| **Listing sources** | Craigslist + StreetEasy via Nimble `/v1/search` & `/v1/extract` | Implemented | PRD focus; fragmented NYC rental market |
| **Borough repository** | SQLite (`node:sqlite`) at `data/listings.db` | Implemented | Five-borough ingest + dedupe by URL; no native build deps on Windows |
| **Analytics DB** | ClickHouse Cloud via `@clickhouse/client` | Connected | `nyc_rent_ledger` + median/delta queries (planned) |
| **Secrets** | `.env` (`dotenv`) | Implemented | `NIMBLE_API_KEY`, `CLICKHOUSE_*` — never committed |
| **Frontend UI** | Next.js or Vite + React (TBD) | Planned | Replaces original Streamlit plan; deploy to Vercel/Netlify |
| **Agent orchestration** | Node workflow modules / future LangGraph.js or custom state machine | Planned | Scrape → Evaluate → Chat → Draft/Book with human approval gate |
| **External integrations** | Google Calendar, Senso.ai, Coinbase CDP / x402 | Planned | Discovery + analytics first; actions after MVP |

### 2.1 Repository Layout (implemented)

```
src/
  config/env.js              # dotenv, paths
  nimble/
    client.js                # Nimble SDK HTTP (search + extract)
    parsers.js               # rent/bed regex, listing URL detection
    realEstateSearch.js      # Craigslist + StreetEasy borough search
    zillow.js                # optional Zillow smoke test
  listings/
    boroughs.js              # manhattan, brooklyn, queens, bronx, staten_island
    repository.js            # SQLite CRUD + verification_runs
    ingest.js                # multi-borough ingest pipeline
  verification/
    verifier.js              # live/expired classification via Extract
  clickhouse/
    client.js                # @clickhouse/client wrapper
scripts/
  ingest-boroughs.js         # npm run ingest
  verify-listings.js         # npm run verify
  test-clickhouse.js         # npm run test:clickhouse
  test-zillow-scrape.js      # npm run test:zillow (optional)
```

### 2.2 Environment Variables

```env
NIMBLE_API_KEY=...

CLICKHOUSE_HOST=<your-cluster>.clickhouse.cloud
CLICKHOUSE_PORT=8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=...
CLICKHOUSE_DATABASE=default
CLICKHOUSE_SECURE=true
```

### 2.3 Listing Repository Schema (SQLite)

| Column | Purpose |
|--------|---------|
| `source` | `craigslist` \| `streeteasy` |
| `borough` | `manhattan`, `brooklyn`, `queens`, `bronx`, `staten_island` |
| `url` | Unique listing URL |
| `listing_link` | Canonical listing URL |
| `title`, `snippet`, `rent_hint`, `bedrooms`, `bathrooms` | Parsed from search + Extract |
| `agent_name`, `agency_name`, `agent_email`, `agent_phone` | Nimble Extract first; **Playwright fallback** only when phone/contact missing (Craigslist **requires** phone) |
| `status` | `active` \| `expired` \| `unknown` \| `error` |
| `first_seen_at`, `last_seen_at`, `last_verified_at` | Timestamps (UTC ISO) |
| `verification_note` | Why a listing was marked dead/alive |
| `raw_search_json` | Raw Nimble payload for debugging |

### 2.4 ClickHouse Schema (planned)

Table: **`nyc_rent_ledger`**

- Listing dimensions: `source`, `borough`, `url`, `rent`, `beds`, `baths`, `sqft`, `scraped_at`
- Analytics: rolling zip-code median, `price_delta_pct`, `is_high_priority`, `is_rent_stabilized_match`
- Fed by ingest job after SQLite upsert

### 2.5 Verification Task

1. Select listings where `status IN ('active', 'unknown', 'error')`, oldest `last_verified_at` first.
2. Call Nimble **Extract** on each `url` (rendered, geo: NY).
3. Classify using HTTP status + dead-page phrases (e.g. Craigslist *"posting has been deleted"*, StreetEasy *"no longer available"*).
4. Update `status` and log run stats in `verification_runs`.

**CLI:** `npm run verify` — `node scripts/verify-listings.js --borough brooklyn --limit 25`

---

## 3. Data Sources & Search Criteria

### 3.1 Primary sources

| Source | Domain filter | Borough query pattern |
|--------|---------------|------------------------|
| **Craigslist** | `craigslist.org` | `site:newyork.craigslist.org {borough} apa apartments for rent` |
| **StreetEasy** | `streeteasy.com` | `site:streeteasy.com/for-rent/nyc/{slug} apartments for rent` |

### 3.2 Tenant criteria (composed into Nimble `query` string)

| Criterion | How to specify |
|-----------|----------------|
| Budget | `"under $3500"`, `"max rent 2800"` in search query |
| Neighborhoods | Borough + neighborhood name in query |
| Bedrooms | `"2 bedroom"`, `"studio"` |
| Move-in date | Natural language or Nimble `time_range` |
| Pet-friendly | `"pet friendly"`, `"dogs allowed"` |
| Rent-stabilized | Post-ingest join vs. NYC building registry CSV (planned) |

Nimble does **not** expose StreetEasy/Craigslist UI filters as structured fields — criteria go in the **`query`** string or post-filter in ClickHouse.

### 3.3 Five boroughs

| ID | Craigslist area | StreetEasy slug |
|----|-----------------|-----------------|
| `manhattan` | manhattan | manhattan |
| `brooklyn` | brooklyn | brooklyn |
| `queens` | queens | queens |
| `bronx` | bronx | bronx |
| `staten_island` | staten island | staten-island |

---

## 4. NPM Commands (implemented)

```bash
npm install

npm run ingest          # all boroughs × Craigslist + StreetEasy
npm run verify          # re-check listings still live
npm run test:clickhouse # SELECT 1 against ClickHouse Cloud
npm run test:zillow     # optional Nimble + Zillow smoke test
```

**Ingest examples:**

```bash
node scripts/ingest-boroughs.js --boroughs all --max-results 10 --depth lite
node scripts/ingest-boroughs.js --boroughs brooklyn queens --listings-only
node scripts/ingest-boroughs.js --dry-run
```

**Verify examples:**

```bash
node scripts/verify-listings.js --limit 25
node scripts/verify-listings.js --borough manhattan --source craigslist
```

---

## 5. Parallel Hackathon Implementation Plan (4 Members)

### Member 1: Frontend UI & State (Next.js / Vite)

| Phase | Time | Deliverables |
|-------|------|--------------|
| **Phase 1** | 11:45 – 1:00 | Onboarding form: Budget, Neighborhoods, Bedrooms, Move-in, Pets, Income, Credit. Persist criteria in client state / API session. |
| **Phase 2** | 1:00 – 2:30 | Pipeline dashboard: ingest status per borough, live vs. expired counts, ClickHouse metrics (neighborhood price delta, stabilization flag). |
| **Phase 3** | 2:30 – 4:00 | Chat view (Senso-backed), calendar confirmation widget, crypto receipt placeholder. |

### Member 2: Orchestration Core (Node workflows)

| Phase | Time | Deliverables |
|-------|------|--------------|
| **Phase 1** | 11:45 – 1:00 | State object: `userCriteria`, `activeListings`, `targetMatch`, `chatHistory`. Pipeline: `ingest` → `evaluate` → `chat` → `action`. |
| **Phase 2** | 1:00 – 2:30 | Wire ingest + ClickHouse evaluate; route high-priority matches to draft-application step. |
| **Phase 3** | 2:30 – 4:00 | Human approval gate before calendar / outbound draft; expose REST or server actions for UI. |

### Member 3: Data Ingestion, Verification & ClickHouse

| Phase | Time | Deliverables |
|-------|------|--------------|
| **Phase 1** | 11:45 – 1:00 | **Done:** Nimble search for Craigslist + StreetEasy; five-borough SQLite repo; `npm run ingest` / `npm run verify`. Load rent-stabilized buildings CSV for cross-reference. |
| **Phase 2** | 1:00 – 2:30 | Deploy `nyc_rent_ledger` in ClickHouse; sync script SQLite → ClickHouse; stabilization join. |
| **Phase 3** | 2:30 – 4:00 | Window-function query: price vs. zip rolling median; export `isHighPriority` flag to orchestration. |

### Member 4: Senso, Rights KB & Actions

| Phase | Time | Deliverables |
|-------|------|--------------|
| **Phase 1** | 11:45 – 1:00 | Senso workspace + tenant outreach template; ingest Good Cause / rent-stabilization docs. |
| **Phase 2** | 1:00 – 2:30 | Node module: user profile + ClickHouse anomaly → Senso API → `cited.md`. |
| **Phase 3** | 2:30 – 4:00 | Google Calendar read/write; Coinbase CDP / x402 simulated receipt for demo. |

---

## 6. Out of Scope (explicit)

- **Automated in-app messaging** on StreetEasy or Craigslist (login-gated, ToS risk, brittle).
- **Zillow as primary source** — optional test script only; hackathon focus is Craigslist + StreetEasy.
- **Python / Streamlit / LangGraph (Python)** — superseded by Node.js stack in this repo.

---

## 7. Final Countdown Schedule & Submission Checklist

### 3:30 – 4:00 PM | Code Freeze & Video

- Stop feature work.
- Run locally:
  - `npm run ingest` (show borough breakdown)
  - `npm run verify` (show live vs. expired)
  - ClickHouse query demo (median / high-priority)
  - Senso `cited.md` + calendar mock
- Record **under 2:45**: onboarding → ingest → verify → highlight → draft output.

### 4:00 – 4:30 PM | Deploy & Submit

- Push to public GitHub (`javier-nyc-rent-concierge`).
- Deploy UI (Vercel / Netlify) + document env vars for judges.
- Devpost: repo URL, demo video, check **Nimble**, **ClickHouse**, **Senso.ai** tracks.
- Submit before **4:30 PM**.

---

## 8. Implementation Status

| Component | Status |
|-----------|--------|
| Nimble client (search + extract) | Done |
| Craigslist + StreetEasy borough ingest | Done |
| SQLite five-borough repository | Done |
| Listing verification task | Done |
| ClickHouse client + connectivity test | Done |
| `nyc_rent_ledger` + analytics queries | Planned |
| Rent-stabilized registry join | Planned |
| Senso content generation | Planned |
| Frontend UI | Planned |
| Google Calendar + x402 demo | Planned |
