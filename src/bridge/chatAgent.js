/**
 * Pi agent bridge for the Next.js /api/chat endpoint.
 * Streams Javier (pi SDK) responses in AI SDK v5 UI message SSE format.
 */

import fs from "fs/promises";
import path from "path";
import { Type } from "typebox";
import {
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  SessionManager,
} from "@mariozechner/pi-coding-agent";
import { ROOT } from "../config/env.js";

const AGENT_DIR = path.join(ROOT, "agent");

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

const ONBOARDING_APPEND = `
## Web onboarding chat

You are helping a tenant define apartment search criteria in a short conversation.

- Ask one focused question at a time.
- When you learn a preference, call \`update_criteria\` with the correct \`field\` and \`value\`.
- For \`amenities\` and \`dealBreakers\`, pass a single string per call (the UI adds chips one at a time).
- When you have bedrooms, max monthly budget, neighborhood, move-in date, and the main must-haves / deal-breakers, call \`ready_to_search\` and invite them to start hunting.
- You MUST call the \`update_criteria\` and \`ready_to_search\` tools — never write tool calls as XML or markdown in the message body.
- Do not mention tool names to the user; just chat naturally.
`.trim();

/** @type {{ session: import("@mariozechner/pi-coding-agent").AgentSession | null, userTurns: number }} */
const state = { session: null, userTurns: 0 };

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
    tools: ["update_criteria", "ready_to_search"],
    customTools: [updateCriteriaTool, readyToSearchTool],
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

async function getSessionForTurn(userTurns) {
  if (userTurns <= 0) {
    throw new Error("No user message in request");
  }
  if (userTurns === 1 || userTurns < state.userTurns) {
    state.session?.dispose?.();
    state.session = await createChatSession();
    state.userTurns = 0;
  }
  if (!state.session) {
    state.session = await createChatSession();
  }
  return state.session;
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

  let session;
  try {
    session = await getSessionForTurn(userTurns);
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
          if (toolName === "update_criteria" || toolName === "ready_to_search") {
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
        state.userTurns = userTurns;

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
}
