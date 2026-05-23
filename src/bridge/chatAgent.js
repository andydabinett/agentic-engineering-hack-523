/**
 * Pi agent bridge for the Next.js /api/chat endpoint.
 * Streams Javier (pi SDK) responses in AI SDK v5 UI message SSE format.
 */

import fs from "fs/promises";
import path from "path";
import { AsyncLocalStorage } from "node:async_hooks";
import { Type } from "typebox";
import {
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  SessionManager,
} from "@mariozechner/pi-coding-agent";
import { ROOT } from "../config/env.js";
import { startAgentScrape } from "../crawler/agentScrape.js";
import {
  buildListingSummary,
  canStartCorrespondence,
  correspondenceFakeDemoEnabled,
  resolveListerPhone,
  startCorrespondence,
} from "./correspondenceService.js";

const AGENT_DIR = path.join(ROOT, "agent");
const chatContext = new AsyncLocalStorage();

/** Criteria from the latest chat request (for borough-aware scrapes). */
let latestSearchCriteria = null;

/** Per-tab correspondence start payloads for the web UI stream. */
const lastCorrespondenceStarts = new Map();

const updateCriteriaTool = defineTool({
  name: "update_criteria",
  label: "Update search criteria",
  description:
    "Record one tenant search preference. Call whenever you learn bedrooms, budget, neighborhood, move-in date, an amenity, or a deal-breaker.",
  parameters: Type.Object({
    field: Type.Union([
      Type.Literal("bedrooms"),
      Type.Literal("maxPrice"),
      Type.Literal("neighborhood"),
      Type.Literal("amenities"),
      Type.Literal("dealBreakers"),
      Type.Literal("moveInDate"),
    ]),
    value: Type.Union([Type.String(), Type.Number()]),
  }),
  async execute() {
    return { content: [{ type: "text", text: "Criteria updated." }], details: {} };
  },
});

const readyToSearchTool = defineTool({
  name: "ready_to_search",
  label: "Ready to search",
  description:
    "Call once when you have enough criteria (bedrooms, budget, neighborhood, move-in, and key preferences) to start listing search.",
  parameters: Type.Object({}),
  async execute() {
    return { content: [{ type: "text", text: "Ready to search." }], details: {} };
  },
});

const scrapeListingsTool = defineTool({
  name: "scrape_listings",
  label: "Scrape listings now",
  description:
    "Pull fresh Craigslist and StreetEasy rentals immediately. Use when the user asks to search, scrape, refresh listings, find apartments now, check what's available, or run a new hunt — including between scheduled background crawls.",
  parameters: Type.Object({
    boroughs: Type.Optional(
      Type.Array(
        Type.Union([
          Type.Literal("manhattan"),
          Type.Literal("brooklyn"),
          Type.Literal("queens"),
          Type.Literal("bronx"),
          Type.Literal("staten_island"),
          Type.Literal("all"),
        ]),
      ),
    ),
    maxResults: Type.Optional(Type.Number()),
    neighborhood: Type.Optional(Type.String()),
  }),
  async execute(params) {
    if (!process.env.NIMBLE_API_KEY?.trim()) {
      return {
        content: [
          {
            type: "text",
            text: "NIMBLE_API_KEY is not configured — cannot scrape listings.",
          },
        ],
        details: { ok: false, status: "error" },
      };
    }

    const result = startAgentScrape({
      boroughs: params.boroughs,
      maxResults: params.maxResults,
      neighborhood: params.neighborhood,
      criteria: latestSearchCriteria,
    });

    const text = result.ok
      ? result.message
      : result.message || "A scrape is already in progress.";

    return {
      content: [{ type: "text", text }],
      details: result,
    };
  },
});

const startCorrespondenceTool = defineTool({
  name: "start_correspondence",
  label: "Start broker SMS thread",
  description:
    "Begin autonomous SMS outreach to schedule a viewing for a listing. Use when the user asks to text, contact, reach out to, or schedule a viewing with a broker or lister — including by listing address or id (e.g. db-24).",
  parameters: Type.Object({
    listingId: Type.String({ description: "Dashboard listing id, e.g. db-24" }),
    listerName: Type.Optional(Type.String()),
    listerPhone: Type.Optional(Type.String()),
  }),
  async execute(params) {
    if (!canStartCorrespondence()) {
      return {
        content: [
          {
            type: "text",
            text: "Correspondence is not configured — set TWILIO_* or CORRESPONDENCE_FAKE_DEMO=1.",
          },
        ],
        details: { ok: false },
      };
    }

    const { openRepository, getListingById } = await import("./listingsApi.js");
    const repo = openRepository();
    let listing;
    try {
      listing = getListingById(repo, params.listingId);
    } finally {
      repo.close();
    }

    if (!listing) {
      return {
        content: [
          {
            type: "text",
            text: `Listing ${params.listingId} was not found in the database.`,
          },
        ],
        details: { ok: false, listingId: params.listingId },
      };
    }

    const phone = resolveListerPhone({
      explicitPhone: params.listerPhone,
      brokerPhone: listing.brokerPhone,
    });
    if (!phone?.trim()) {
      return {
        content: [
          {
            type: "text",
            text: `No broker phone on file for ${listing.address}. Cannot start SMS yet.`,
          },
        ],
        details: { ok: false, listingId: params.listingId },
      };
    }

    try {
      const view = await startCorrespondence({
        listingId: params.listingId,
        listerPhone: phone,
        listerName: params.listerName || listing.brokerName,
        listingSummary: buildListingSummary(listing),
      });

      const details = {
        ok: true,
        fakeDemo: correspondenceFakeDemoEnabled(),
        threadId: view.threadId,
        listingId: view.listingId,
        status: view.status,
        listerName: view.listerName || listing.brokerName,
        listerPhone: view.listerPhone,
        brokerName: listing.brokerName,
        address: listing.address,
        messages: view.messages,
      };
      const chatSessionId = chatContext.getStore()?.chatSessionId ?? "default";
      lastCorrespondenceStarts.set(chatSessionId, details);

      return {
        content: [
          {
            type: "text",
            text: `Started texting ${listing.brokerName} about ${listing.address}. I'll keep negotiating in the background.`,
          },
        ],
        details,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: message }],
        details: { ok: false, error: message },
      };
    }
  },
});

const ONBOARDING_APPEND = `
## Web onboarding chat

You are helping a tenant define apartment search criteria in a short conversation.

- Ask one focused question at a time.
- When you learn a preference, call \`update_criteria\` with the correct \`field\` and \`value\`.
- For \`amenities\` and \`dealBreakers\`, pass a single string per call (the UI adds chips one at a time).
- When you have bedrooms, max monthly budget, neighborhood, move-in date, and the main must-haves / deal-breakers, call \`ready_to_search\` and invite them to start hunting.
- When the user wants listings pulled **now** (search, refresh, scrape, "what's out there", "find apartments", "run a search"), call \`scrape_listings\`. Pass \`boroughs\` from their neighborhood when known; otherwise \`["all"]\` or the relevant borough id.
- After calling \`scrape_listings\`, tell them fresh results will appear on the dashboard in a few minutes — they do not need to wait for the background crawler.
- When the user wants to **text a broker**, **reach out**, **contact a listing**, or **schedule a viewing** for a specific apartment, call \`start_correspondence\` with that listing's \`listingId\` (from the dashboard, e.g. \`db-24\`). If they describe the unit by address, match it to the best listing id you can infer.
- After \`start_correspondence\`, tell them Javier is texting the broker and they can watch the thread on Messages.
- You MUST call tools for criteria, readiness, scrapes, and outreach — never write tool calls as XML or markdown in the message body.
- Do not mention tool names to the user; just chat naturally.
`.trim();

/** @type {Map<string, { session: import("@mariozechner/pi-coding-agent").AgentSession | null, userTurns: number }>} */
const chatSessions = new Map();

async function getSessionForTurn(chatSessionId, userTurns) {
  if (userTurns <= 0) {
    throw new Error("No user message in request");
  }

  let entry = chatSessions.get(chatSessionId);
  if (userTurns === 1 || userTurns < (entry?.userTurns ?? 0)) {
    entry?.session?.dispose?.();
    entry = { session: await createChatSession(), userTurns: 0 };
    chatSessions.set(chatSessionId, entry);
  }

  if (!entry?.session) {
    entry = { session: await createChatSession(), userTurns: 0 };
    chatSessions.set(chatSessionId, entry);
  }

  return entry.session;
}

async function loadSystemPrompt() {
  const systemPath = path.join(AGENT_DIR, "SYSTEM.md");
  let base = "";
  try {
    base = await fs.readFile(systemPath, "utf8");
  } catch {
    base = "You are Javier, an NYC rent concierge.";
  }
  return `${base}\n\n${ONBOARDING_APPEND}`;
}

async function createChatSession() {
  const systemPrompt = await loadSystemPrompt();
  const resourceLoader = new DefaultResourceLoader({
    cwd: ROOT,
    agentDir: AGENT_DIR,
    systemPromptOverride: () => systemPrompt,
    appendSystemPromptOverride: () => [],
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd: ROOT,
    agentDir: AGENT_DIR,
    tools: [
      "update_criteria",
      "ready_to_search",
      "scrape_listings",
      "start_correspondence",
    ],
    customTools: [
      updateCriteriaTool,
      readyToSearchTool,
      scrapeListingsTool,
      startCorrespondenceTool,
    ],
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
  });

  return session;
}

/**
 * @param {Array<{ role?: string; parts?: Array<{ type?: string; text?: string }> }>} messages
 */
function extractLastUserText(messages) {
  const users = (messages ?? []).filter((m) => m?.role === "user");
  const last = users[users.length - 1];
  if (!last) return null;
  if (Array.isArray(last.parts)) {
    const text = last.parts
      .filter((p) => p?.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
    if (text.trim()) return text.trim();
  }
  if (typeof last.content === "string" && last.content.trim()) {
    return last.content.trim();
  }
  return null;
}

function countUserTurns(messages) {
  return (messages ?? []).filter((m) => m?.role === "user").length;
}

const encoder = new TextEncoder();

/**
 * @param {Request} req
 * @returns {Promise<Response>}
 */
export async function handleChatRequest(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const messages = body.messages ?? [];
  latestSearchCriteria = body.criteria ?? null;
  const userTurns = countUserTurns(messages);
  const promptText = extractLastUserText(messages);

  if (!promptText) {
    return new Response(JSON.stringify({ error: "Missing user message" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return new Response(
      JSON.stringify({
        error:
          "OPENROUTER_API_KEY is not set. Add it to the repo root .env (see .env.example).",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const chatSessionId =
    typeof body.chatSessionId === "string" && body.chatSessionId.trim()
      ? body.chatSessionId.trim()
      : "default";

  return chatContext.run({ chatSessionId }, async () => {
    let session;
    try {
      session = await getSessionForTurn(chatSessionId, userTurns);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messageId = `pi-${Date.now()}`;
    const textId = `pi-txt-${Date.now()}`;
    let textStarted = false;
    let agentDone = false;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        const unsubscribe = session.subscribe((event) => {
          if (event.type === "message_update") {
            const inner = event.assistantMessageEvent;
            if (inner.type === "text_delta" && inner.delta) {
              if (!textStarted) {
                send({ type: "text-start", id: textId });
                textStarted = true;
              }
              send({ type: "text-delta", id: textId, delta: inner.delta });
            }
          }

          if (event.type === "tool_execution_start") {
            const { toolName, toolCallId, args } = event;
            if (
              toolName === "update_criteria" ||
              toolName === "ready_to_search" ||
              toolName === "scrape_listings" ||
              toolName === "start_correspondence"
            ) {
              send({
                type: "tool-input-available",
                toolCallId,
                toolName,
                input: args ?? {},
              });
            }
          }

          if (event.type === "agent_end") {
            agentDone = true;
          }
        });

      try {
        send({ type: "start", messageId });

        await session.prompt(promptText);
        const entry = chatSessions.get(chatSessionId);
        if (entry) entry.userTurns = userTurns;

        const correspondenceStart = lastCorrespondenceStarts.get(chatSessionId);
        if (correspondenceStart?.ok) {
          send({
            type: "data-correspondence-started",
            data: correspondenceStart,
          });
          lastCorrespondenceStarts.delete(chatSessionId);
        }

        if (textStarted) {
          send({ type: "text-end", id: textId });
        }
        send({ type: "finish" });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const errorText = err instanceof Error ? err.message : String(err);
        send({ type: "error", errorText });
        if (!agentDone) {
          send({ type: "finish" });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        }
      } finally {
        unsubscribe();
        controller.close();
      }
    },
  });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "x-vercel-ai-ui-message-stream": "v1",
      },
    });
  });
}
