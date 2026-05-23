# Production readiness & correspondence refactor

Branch: **`refactor/prod-readiness`**

Goal: make correspondence work in deployed environments, reduce two-server operational burden, and close the highest-risk gaps from the senior review — without a big-bang rewrite.

---

## Current problems (why this branch exists)

1. **Production only starts Next.js** — Hono correspondence never runs (`scripts/start-production.sh`).
2. **Web talks to Hono over HTTP** — extra hop via `correspondenceClient.js` + `CORRESPONDENCE_API_URL`.
3. **ClickHouse env mismatch** — correspondence reads `CLICKHOUSE_PASSWORD`; deploy docs use `CLICKHOUSE_API_KEY` → in-memory threads in prod.
4. **No auth** on ingest / correspondence start endpoints.
5. **Chat agent global state** — unsafe under concurrency.

---

## Strategy

**Phase 1–2:** Ship fixes that unblock production (small diffs, high value).  
**Phase 3:** Decide and implement server topology (co-process vs unify into Next).  
**Phase 4–5:** Hardening, CI, and optional cleanup.

Default recommendation for Phase 3: **co-process in Docker first** (fast), then **import orchestrator into Next** (delete proxy) when stable.

---

## Phase 1 — P0 prod fixes (do first)

### 1.1 ClickHouse config for correspondence

- [x] Update `src/config.ts` to accept `CLICKHOUSE_API_KEY` (and `CLICKHOUSE_URL`) like `src/config/clickhouseEnv.js`.
- [x] Align default `CLICKHOUSE_DATABASE` with deploy docs (`default` or document `javier` explicitly).
- [x] Add test: `clickhouseConfigured()` true when only `CLICKHOUSE_API_KEY` is set.

**Done when:** correspondence server uses real ClickHouse when Railway env matches `DEPLOY.md`.

### 1.2 Start correspondence in production

- [x] Update `scripts/start-production.sh` to start Hono on internal port (e.g. `3001`) before Next.
- [x] Set `CORRESPONDENCE_API_URL=http://127.0.0.1:3001` in Dockerfile or start script.
- [x] Ensure Hono gets SIGTERM on container shutdown (trap + kill).

**Done when:** single Railway deploy serves dashboard **and** `GET /health` on `:3001` (or proxied) responds; `POST /api/correspondence/start` succeeds without a second manual service.

### 1.3 Deploy docs

- [x] Extend `DEPLOY.md` with correspondence env table:
  - `CORRESPONDENCE_API_URL`
  - `TWILIO_*` (optional if fake demo)
  - `CORRESPONDENCE_FAKE_DEMO` / `CORRESPONDENCE_DEV`
  - `npm run init:clickhouse` for correspondence tables
- [x] Document Twilio webhook URL: `{PUBLIC_URL}/webhooks/twilio/sms` (or Next proxy path if unified later).
- [x] Note: fake demo needs no Twilio inbound.

**Done when:** a new teammate can deploy correspondence from docs alone.

---

## Phase 2 — Security & ops (quick wins)

### 2.1 API guard (minimal auth)

- [x] Add optional `API_SECRET` env var.
- [x] Require `Authorization: Bearer <API_SECRET>` (or `x-api-key`) on:
  - `POST /api/ingest`
  - `POST /api/correspondence/start`
  - `POST /api/correspondence/*/simulate-reply`
- [x] Skip check when `API_SECRET` unset (local dev).

**Done when:** production can lock down write endpoints with one env var.

### 2.2 Dev route safety

- [x] Ensure `CORRESPONDENCE_FAKE_DEMO` and `CORRESPONDENCE_DEV` default off in production Dockerfile.
- [x] Log warning at startup if dev routes enabled with `NODE_ENV=production`.

**Done when:** misconfigured prod cannot expose `simulate-reply` silently.

### 2.3 CI

- [x] Add `.github/workflows/test.yml`: `npm ci` + `npm test` on PR/push to `main`.

**Done when:** PR #8+ cannot merge with broken tests (optional: branch protection).

---

## Phase 3 — Server topology (pick one path)

### Option A — Co-process (recommended first)

- [x] Hono stays as separate process inside same container.
- [x] Keep `correspondenceClient.js` HTTP client for scripts / standalone Hono dev.
- [x] Health: document internal `:3001` vs public Next `:3000`.

**Pros:** ~1 hour, low risk. **Cons:** still two processes.

### Option B — Unify into Next (recommended follow-up)

- [x] Extract shared factory: `src/correspondence/service.ts` from `src/app.ts`.
- [x] Next routes call orchestrator directly (no HTTP):
  - `web/app/api/correspondence/*`
  - `web/app/api/webhooks/twilio/sms/route.ts`
- [x] Keep `src/index.ts` as thin dev-only entry for ngrok / Google OAuth.
- [x] Remove `correspondenceClient.js` from server-side call paths; keep for scripts.

**Pros:** one process for correspondence in Next, simpler deploy, Twilio → public Next URL. **Cons:** co-process Hono still runs in prod for OAuth until removed.

**Decision gate:** after Phase 1 ships, run fake demo + one real Twilio test on Railway. If stable with co-process, Option B can wait until post-hackathon.

---

## Phase 4 — Chat & UI hardening

### 4.1 Chat session isolation

- [x] Replace module-level `state` in `chatAgent.js` with per-session map keyed by client `chatSessionId`.
- [x] `ChatPanel` sends stable `chatSessionId` per tab.

**Done when:** two concurrent chat tabs do not share agent state.

### 4.2 `update_criteria` tool

- [ ] Either persist criteria server-side (session/redis/sqlite) or document that tool is UI-hint only and remove from agent prompt confusion.

### 4.3 Polling → SSE (optional)

- [ ] Replace 2.5s poll in `CorrespondenceHydrator` with SSE stream from `/api/correspondence/[id]/stream` when time allows.

---

## Phase 5 — Cleanup & debt (post-demo)

- [ ] Unify ClickHouse migrations (`clickhouse-migrate.js` + `init_clickhouse.ts`) under one command.
- [x] `dev:stack` runs fake correspondence server + web (`scripts/dev-stack.sh`).
- [ ] Wire or remove `NotificationService` stub.
- [ ] Encrypt Google refresh tokens at rest.
- [ ] Consolidate dotenv versions (root vs web).

---

## Verification checklist (run before merge)

```bash
# Unit tests
npm test

# Fake UI demo (no Twilio inbound)
CORRESPONDENCE_FAKE_DEMO=1 CORRESPONDENCE_DEV=1 npm run server:fake   # :3001
npm run web:dev                                                       # :3000/3002
# → Demo reach out on matched listing → Messages fills

# ClickHouse config
CLICKHOUSE_HOST=... CLICKHOUSE_API_KEY=... npm run server
curl http://localhost:3001/health   # clickhouseConfigured: true

# Production script (local smoke)
npm run start:prod   # both processes; correspondence start via UI

# Twilio (optional)
npm run dev:correspondence
npm run demo:correspondence -- +18777804236
```

---

## Suggested commit sequence on this branch

1. `fix: read CLICKHOUSE_API_KEY in correspondence config`
2. `fix: start Hono correspondence server in production entrypoint`
3. `docs: extend DEPLOY.md for correspondence and Twilio`
4. `feat: optional API_SECRET guard on write endpoints`
5. `ci: add test workflow`
6. *(optional)* `refactor: call orchestrator directly from Next API routes`

---

## Out of scope (for now)

- Full multi-tenant auth / user accounts
- Vercel-first deployment with persistent correspondence (Railway is the target)
- Replacing pi-agent with a different LLM stack
- Senso / x402 integrations (PRD only)

---

## References

- Integration map: [INTEGRATION.md](INTEGRATION.md)
- Demo flows: [DEMO.md](DEMO.md)
- Deploy: [DEPLOY.md](DEPLOY.md)
- Correspondence server entry: [src/index.ts](src/index.ts)
- Production start: [scripts/start-production.sh](scripts/start-production.sh)
