# Javier — NYC Rent Concierge (frontend)

The dashboard for an AI agent that finds apartments in NYC (East Village
focused), texts brokers via SMS, parses replies, checks your Google
Calendar, and books viewings autonomously. This package is the
**frontend only** — the chat agent lives elsewhere (sibling `/agent`)
and connects through a small `/api/chat` contract that is currently
stubbed.

Built with Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn-style
primitives, the Vercel AI SDK v5 (`@ai-sdk/react`), Framer Motion, and
Zustand.

---

## Run

From this directory:

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. The root redirects to `/onboarding`.

> The build/runtime is fully self-contained. No env vars, no DB, no
> outbound network calls except to Unsplash for listing photos. Tested
> on Node 22+.

---

## Routes

| Path                  | What it is                                                              |
| --------------------- | ----------------------------------------------------------------------- |
| `/onboarding`         | 60/40 chat ↔ criteria card. Talk to the agent, watch it fill criteria.  |
| `/dashboard`          | Listings grid + live activity feed + sticky status bar.                 |
| `/listing/[id]`       | Photo gallery, broker card, Fair Price Analysis, embedded SMS thread.   |
| `/messages`           | iMessage-style inbox: thread list + selected conversation.              |
| `/calendar`           | Week view with agent-booked viewings and personal events.               |

The persistent left sidebar appears on all post-onboarding pages, plus a
floating bottom-right chat button that opens the same chat in a drawer.

---

## The `/api/chat` contract

The frontend uses `useChat` from `@ai-sdk/react` (AI SDK v5). The
current implementation in `app/api/chat/route.ts` is a **stub** that
streams canned scripted responses — a real agent should replace it.

### Wire format

The endpoint returns Server-Sent Events using the **AI SDK v5 UI
Message Stream protocol**:

- `Content-Type: text/event-stream`
- `x-vercel-ai-ui-message-stream: v1`
- Events are JSON objects, one per `data:` line.

Standard event types used by this app:

```
data: {"type":"start","messageId":"..."}
data: {"type":"text-start","id":"..."}
data: {"type":"text-delta","id":"...","delta":"..."}
data: {"type":"text-end","id":"..."}
data: {"type":"finish"}
data: [DONE]
```

### Tool calls — two flavors of signal

The agent has two "tool calls" the frontend reacts to. To keep the stub
trivial, they are emitted as **custom data parts** (the simpler half of
the v5 protocol). The frontend also accepts real `tool-input-available`
parts under the same names, so the real agent has its choice.

#### 1. `update_criteria`

Streams as soon as the agent learns a new constraint. The criteria
card on the right of `/onboarding` animates a slide-in for the new
value.

Stub form (data part):

```json
{
  "type": "data-update-criteria",
  "data": { "field": "<field>", "value": <scalar> }
}
```

Real form (tool call):

```json
{
  "type": "tool-input-available",
  "toolCallId": "...",
  "toolName": "update_criteria",
  "input": { "field": "<field>", "value": <scalar> }
}
```

`field` ∈ `"bedrooms" | "maxPrice" | "neighborhood" | "amenities" |
"dealBreakers" | "moveInDate"`.

For `"amenities"` and `"dealBreakers"`, `value` is a single string and
the frontend **appends** it to the existing array (one-by-one chip
animation). For the other fields, `value` is a scalar that replaces
the current value.

#### 2. `ready_to_search`

Fired once when the agent has enough to start hunting. Enables the
"Start hunting" CTA with an accent-gradient glow; clicking it routes to
`/dashboard`.

Stub form:

```json
{ "type": "data-ready-to-search", "data": {} }
```

Real form:

```json
{
  "type": "tool-input-available",
  "toolCallId": "...",
  "toolName": "ready_to_search",
  "input": {}
}
```

### Replacing the stub

1. Implement `app/api/chat/route.ts` to call your agent (pi SDK +
   OpenRouter, in the sibling `/agent` package, can speak this
   protocol directly via `streamText().toUIMessageStreamResponse()`).
2. Make sure your agent emits **either** the custom data parts above
   **or** real tool calls with the same `toolName`s and shapes — the
   frontend handles both. See `components/chat-panel.tsx` (the `onData`
   and `onToolCall` handlers).
3. The request body shape is whatever `useChat` sends by default
   (an object containing `messages`, an array of v5 `UIMessage`s).
   `app/api/chat/route.ts` only needs to count user messages from
   `body.messages` to decide what to stream back.

---

## Demo mode (`⌘⇧D` / `Ctrl⇧D`)

On `/dashboard`, the keyboard shortcut `Cmd+Shift+D` (or its small
button in the page header) runs a scripted ~12-second sequence the
presenter can trigger live:

| t       | What happens                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0s      | A new listing card animates in at the top of the grid with a green "Just matched" pulse and a toast ("New match found").                          |
| 3s      | Card status flips to "Broker texted" (blue) and an entry appears in the activity feed.                                                            |
| 6s      | Status flips to "Awaiting reply" (amber). A fresh SMS conversation appears on `/messages` with the agent's outbound message. Chat notif dot lights.|
| 10s     | Broker reply bubble appears ("Wednesday at 6 works"). Status flips to "Viewing scheduled" (purple). Activity feed entry added.                    |
| 12s     | New viewing event appears on `/calendar` at Wed 6pm. Agent's confirmation reply lands in the thread.                                              |

You can run it multiple times in a presentation — each invocation
uses the next address/broker from a small rotation and creates fresh
listing/conversation/viewing records.

The shortcut is registered globally via a key listener in
`components/use-demo-mode.ts`; it only causes visible effects when the
user is on `/dashboard` (the listener is mounted in that page's
component tree).

---

## Design

The visual direction was prompted at build time using **the impeccable
design skill** (<https://github.com/pbakaus/impeccable>), with these
constraints:

- Aesthetic: Linear meets StreetEasy — modern, editorial, slightly serious.
- Off-white #FAFAF7 canvas, near-black #0F0F0E ink, warm gray #E8E5E0 rules.
- One accent: burnt orange #C84A1B, used sparingly (CTA, active nav,
  agent message bubbles, accent dots).
- Typography: Inter for body/UI; Fraunces for serif (prices, major headings).
- Animations: subtle and intentional. Borders over shadows.

Design tokens live as HSL CSS variables in `app/globals.css`, surfaced
to Tailwind through semantic class names (`bg-canvas`, `text-ink`,
`border-rule`, `text-accent-deep`, `bg-signal-purple-soft`, etc.).
See `tailwind.config.ts` for the full mapping.

---

## File map

```
app/
  layout.tsx            Root layout: fonts, sidebar nav, floating chat, toaster
  page.tsx              Redirects to /onboarding
  globals.css           Design tokens + base styles
  onboarding/page.tsx   60/40 chat + criteria
  dashboard/page.tsx    Status bar + grid + activity + demo
  listing/[id]/page.tsx Detail + gallery + FPA + embedded SMS
  messages/page.tsx     Inbox + thread
  calendar/page.tsx     Week view
  api/chat/route.ts     ★ Stub endpoint to replace

components/
  ui/                   shadcn-style primitives (button, card, sheet, ...)
  chat-panel.tsx        useChat-powered chat with tool-call handling
  criteria-card.tsx     Animated slide-in fields + CTA
  listing-card.tsx      Dashboard tile with status pill + match badge
  listing-gallery.tsx   Primary + thumbnails
  fair-price-analysis.tsx  Editorial analysis block with citations
  message-thread.tsx    iMessage-style bubbles + day separators
  activity-feed.tsx     Vertical timeline of agent actions
  dashboard-status-bar.tsx  Sticky counters with count-up animation
  calendar-grid.tsx     Week grid with positioned event blocks
  use-demo-mode.ts      Cmd+Shift+D scripted sequence
  sidebar-nav.tsx       Persistent left navigation
  floating-chat.tsx     Bottom-right circular button + drawer
  client-time.tsx       SSR-safe relative/absolute time renderers

lib/
  types.ts              Listing, Conversation, Viewing, etc.
  mockData.ts           12 listings, 4 convos, viewings, events
  store.ts              Zustand store (criteria + listings + convos + ...)
  utils.ts              cn(), formatPrice(), brokerInitials(), ...
```
