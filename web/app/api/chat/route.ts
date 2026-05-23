/**
 * Stub implementation of the /api/chat endpoint.
 *
 * Streams canned scripted responses to the frontend chat using the
 * AI SDK v5 UI Message Stream protocol (Server-Sent Events). It mimics
 * what the real agent (Javier, separate teammate) will eventually send.
 *
 * The stub emits two kinds of tool-call signals as custom data parts:
 *
 *   - { type: "data-update-criteria", data: { field, value } }
 *     where field ∈ "bedrooms" | "maxPrice" | "neighborhood" |
 *                   "amenities" | "dealBreakers" | "moveInDate"
 *     - For "amenities" and "dealBreakers", `value` is a single string
 *       and the frontend appends it to the array (one-by-one animation).
 *     - For other fields, `value` is a scalar that replaces the field.
 *
 *   - { type: "data-ready-to-search", data: {} }
 *     Marks the search as ready to start. Frontend enables the
 *     "Start hunting" CTA with an accent glow.
 *
 * When the real agent replaces this, it can either:
 *   (a) emit the same custom data parts, OR
 *   (b) emit real `tool-input-available` parts with toolName
 *       "update_criteria" / "ready_to_search" — the frontend handles
 *       both shapes (see components/chat-panel.tsx).
 */

export const runtime = "nodejs";

const encoder = new TextEncoder();

type Step =
  | { kind: "text"; value: string }
  | { kind: "criteria"; field: string; value: string | number }
  | { kind: "ready" }
  | { kind: "delay"; ms: number };

const TURNS: Step[][] = [
  // Turn 1
  [
    { kind: "text", value: "Got it — a one-bedroom. What's your monthly budget?" },
    { kind: "delay", ms: 350 },
    { kind: "criteria", field: "bedrooms", value: 1 },
  ],
  // Turn 2
  [
    { kind: "text", value: "Solid. Which neighborhoods are you considering?" },
    { kind: "delay", ms: 320 },
    { kind: "criteria", field: "maxPrice", value: 4500 },
  ],
  // Turn 3
  [
    { kind: "text", value: "Great — East Village it is. Any must-haves I should know about?" },
    { kind: "delay", ms: 280 },
    { kind: "criteria", field: "neighborhood", value: "East Village" },
  ],
  // Turn 4
  [
    {
      kind: "text",
      value:
        "Noted: pet-friendly, no broker fee, dishwasher in the unit. Anything that's an absolute no?",
    },
    { kind: "delay", ms: 250 },
    { kind: "criteria", field: "amenities", value: "pet-friendly" },
    { kind: "delay", ms: 350 },
    { kind: "criteria", field: "amenities", value: "no broker fee" },
    { kind: "delay", ms: 350 },
    { kind: "criteria", field: "amenities", value: "dishwasher" },
  ],
  // Turn 5
  [
    {
      kind: "text",
      value:
        "Perfect — moving in June, no ground-floor units, no shared bathrooms. I have what I need. Ready to start hunting?",
    },
    { kind: "delay", ms: 250 },
    { kind: "criteria", field: "moveInDate", value: "June 1, 2026" },
    { kind: "delay", ms: 300 },
    { kind: "criteria", field: "dealBreakers", value: "ground floor" },
    { kind: "delay", ms: 300 },
    { kind: "criteria", field: "dealBreakers", value: "shared bathroom" },
    { kind: "delay", ms: 350 },
    { kind: "ready" },
  ],
];

// After turn 5, agent answers casually with no tool calls.
function postFlightReply(turn: number): Step[] {
  const replies = [
    "Still monitoring listings — I'll flag anything that fits as it appears.",
    "Got it. I'll text the broker as soon as something matches.",
    "Heard. Want me to widen the budget by $250 to catch more options?",
    "Watching. I'll ping you the moment a viewing locks in.",
  ];
  return [{ kind: "text", value: replies[turn % replies.length] }];
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

interface ChatMessageLike {
  role: "user" | "assistant" | "system";
}

export async function POST(req: Request) {
  let body: { messages?: ChatMessageLike[] } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine for a stub
  }

  const userTurns = (body.messages ?? []).filter(
    (m) => m && m.role === "user",
  ).length;
  const turnIndex = Math.max(0, userTurns - 1);
  const steps =
    turnIndex < TURNS.length
      ? TURNS[turnIndex]
      : postFlightReply(turnIndex - TURNS.length);

  const messageId = `stub-msg-${Date.now()}`;
  const textId = `stub-txt-${Date.now()}`;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        // 1. Begin the assistant message
        send({ type: "start", messageId });

        // 2. Open a text block
        send({ type: "text-start", id: textId });

        // Run steps in order, simulating streaming
        for (const step of steps) {
          switch (step.kind) {
            case "text": {
              // Chunk the text into small word groups for a natural typing feel
              const tokens = step.value.split(/(\s+)/);
              for (let i = 0; i < tokens.length; i += 2) {
                const chunk = (tokens[i] ?? "") + (tokens[i + 1] ?? "");
                if (chunk) {
                  send({ type: "text-delta", id: textId, delta: chunk });
                  await sleep(28);
                }
              }
              break;
            }
            case "delay": {
              await sleep(step.ms);
              break;
            }
            case "criteria": {
              send({
                type: "data-update-criteria",
                data: { field: step.field, value: step.value },
              });
              break;
            }
            case "ready": {
              send({ type: "data-ready-to-search", data: {} });
              break;
            }
          }
        }

        // 3. Close the text block and finish
        send({ type: "text-end", id: textId });
        send({ type: "finish" });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        // Surface errors as an error event then close
        send({
          type: "error",
          errorText: err instanceof Error ? err.message : String(err),
        });
      } finally {
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
