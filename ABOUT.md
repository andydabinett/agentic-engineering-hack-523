# Javier — The NYC Apartment Hunting Agent

Javier is an AI agent that finds, evaluates, and books NYC apartments for you. You give it your criteria — budget, neighborhoods, bedrooms, move-in date, preferences (rent stabilized, pet-friendly, laundry, etc.) — and it handles the rest.

## What It Does

### 1. Discovers
Nimble scrapes StreetEasy, Zillow, and Craigslist in real time. Listings are cross-referenced against the NYC Rent Guidelines Board's public rent-stabilized building database. Javier flags buildings that are rent-stabilized but weren't advertised as such — a genuinely valuable insight most renters can't easily get.

### 2. Evaluates
Every listing gets scored and stored in ClickHouse. Scoring factors: price vs. neighborhood median, price per square foot, days on market, whether similar units in the building rented for less recently, and commute time to your office. ClickHouse runs these analytical queries across thousands of listings instantly and builds price history over time — so Javier can flag deals ("this unit dropped $200 this week" or "this neighborhood is 15% below the average").

### 3. Recommends
The agent presents its top picks and you have a conversation. "Why did you rank this one high?" "What's the catch with this listing?" "Is this neighborhood safe?" Answers are grounded in Senso's knowledge base of NYC tenant rights, rent stabilization rules, and Good Cause Eviction law — not generic LLM knowledge.

### 4. Acts
Javier checks your Google Calendar for availability, drafts an inquiry to the landlord or broker, and books a tour. If you approve, it sends the message and adds the viewing to your calendar. It can also pre-fill rental applications with your info.

## Stack

| Layer | Tool |
|-------|------|
| Agent framework | pi-agent-core + OpenRouter |
| Web server | Hono (TypeScript) |
| Scraping | Nimble |
| Analytics / storage | ClickHouse Cloud |
| Knowledge base | Senso (NYC housing law + tenant rights) |
| Calendar | Google Calendar MCP |

## Why the Sponsor Tools Are Legit

- **Nimble** — scraping multiple listing sites in real time and bypassing bot protection is exactly what their product does
- **ClickHouse** — running analytical queries across a large dataset (price comparisons, trend detection, neighborhood analytics) is a real workload
- **Senso** — stores verified NYC housing law so the agent's advice is legally grounded, not hallucinated

## The Demo

> "I'm looking for a rent-stabilized 1BR under $2,500 in Brooklyn, pet-friendly."

Javier scrapes listings → cross-references the stabilization database → scores them in ClickHouse → presents the top 3 with explanations grounded in Senso's tenant rights knowledge → books a tour on your actual Google Calendar. Live on stage.

## Sprint Plan (5.5 hours)

**Phase 1 — Foundation (0–1h)**
Hono server + `/chat` endpoint. Initialize the pi SDK — set up `PiAgent` with OpenRouter, define the system prompt, and confirm the agent loop is running end to end. ClickHouse `listings` table. Nimble call against a Craigslist NYC URL, parse HTML into structured data, insert a row.

**Phase 2 — Agent Tools (1–2.5h)**
Define tools as pi SDK tool definitions: `search_listings`, `query_listings`, `check_rent_stabilized`, `lookup_tenant_rights`, `check_calendar`, `book_tour`. Register them with the agent and wire in the implementations. The pi SDK handles the call model → execute tool → feed result back → repeat loop automatically.

**Phase 3 — Intelligence Layer (2.5–3.5h)**
Scoring logic (price vs. median, stabilization status, days on market). Load NYC tenant rights into Senso. Agent can explain recommendations with citations, grounded through the pi SDK's knowledge tool integration.

**Phase 4 — Action & Calendar (3.5–4.5h)**
Google Calendar MCP wired as a pi SDK tool — check availability, propose a tour time, create the event, draft the landlord inquiry.

**Phase 5 — Demo Polish (4.5–5.5h)**
Minimal chat UI or clean terminal demo. Prepare the demo script. Record a backup video.

## Fallbacks

- Craigslist scraping via Nimble might be flaky — keep a cached dataset ready
- Senso integration slower than expected — worst case, hardcode tenant rights in the system prompt
- Calendar is the flashiest demo moment but build it last; the core value works without it
