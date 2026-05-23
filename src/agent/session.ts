import { Type } from "typebox";
import { createAgentSession, defineTool } from "@mariozechner/pi-coding-agent";

import type { Config } from "../config.ts";
import type { CorrespondenceOrchestrator } from "../services/correspondence/orchestrator.ts";
import type { CorrespondenceAgentRunner } from "./runner.ts";

function buildTools(orchestrator: CorrespondenceOrchestrator) {
  const sendSmsTool = defineTool({
    name: "send_sms",
    label: "Send SMS",
    description: "Send an outbound SMS to the lister for the active correspondence thread.",
    parameters: Type.Object({
      threadId: Type.String({ description: "Correspondence thread ID" }),
      body: Type.String({ description: "SMS message body, max 320 chars" }),
    }),
    execute: async (_toolCallId, params) => {
      const message = await orchestrator.sendSms(params.threadId, params.body);
      return {
        content: [{ type: "text" as const, text: `SMS sent: ${message.messageId}` }],
        details: { messageId: message.messageId },
      };
    },
  });

  const getThreadContextTool = defineTool({
    name: "get_thread_context",
    label: "Get thread context",
    description: "Read listing details and message history for a correspondence thread.",
    parameters: Type.Object({
      threadId: Type.String({ description: "Correspondence thread ID" }),
    }),
    execute: async (_toolCallId, params) => {
      const context = await orchestrator.getThreadContext(params.threadId);
      return {
        content: [{ type: "text" as const, text: context }],
        details: {},
      };
    },
  });

  const checkCalendarTool = defineTool({
    name: "check_calendar",
    label: "Check calendar",
    description: "Return busy blocks on the user's Google Calendar in a time range.",
    parameters: Type.Object({
      threadId: Type.String({ description: "Correspondence thread ID" }),
      timeMin: Type.String({ description: "ISO8601 start time" }),
      timeMax: Type.String({ description: "ISO8601 end time" }),
    }),
    execute: async (_toolCallId, params) => {
      const busy = await orchestrator.checkCalendar(
        params.threadId,
        params.timeMin,
        params.timeMax,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: busy.length
              ? `Busy blocks: ${JSON.stringify(busy)}`
              : "Calendar is free in that range.",
          },
        ],
        details: { busy },
      };
    },
  });

  const bookViewingTool = defineTool({
    name: "book_viewing",
    label: "Book viewing",
    description: "Create a Google Calendar event after the lister confirms a viewing time.",
    parameters: Type.Object({
      threadId: Type.String({ description: "Correspondence thread ID" }),
      start: Type.String({ description: "ISO8601 event start" }),
      end: Type.String({ description: "ISO8601 event end" }),
      title: Type.String({ description: "Calendar event title" }),
      location: Type.Optional(Type.String()),
      description: Type.Optional(Type.String()),
    }),
    execute: async (_toolCallId, params) => {
      const result = await orchestrator.bookViewing(params.threadId, {
        start: params.start,
        end: params.end,
        title: params.title,
        location: params.location,
        description: params.description,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Calendar event created: ${result.eventId}`,
          },
        ],
        details: result,
      };
    },
  });

  return [sendSmsTool, getThreadContextTool, checkCalendarTool, bookViewingTool];
}

export class PiCorrespondenceAgent implements CorrespondenceAgentRunner {
  constructor(private readonly config: Config) {}

  async run(
    orchestrator: CorrespondenceOrchestrator,
    threadId: string,
    instruction: string,
  ): Promise<void> {
    if (!this.config.openRouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is required for Pi agent runs");
    }

    process.env.OPENROUTER_API_KEY = this.config.openRouterApiKey;

    const tools = buildTools(orchestrator);
    const { session } = await createAgentSession({
      customTools: tools,
      tools: ["send_sms", "get_thread_context", "check_calendar", "book_viewing"],
      noTools: "builtin",
    });

    const context = await orchestrator.getThreadContext(threadId);
    const prompt = [
      "You are Javier's correspondence agent coordinating apartment viewings over SMS.",
      "Keep SMS under 320 characters. Be professional and concise.",
      "Use send_sms to message the lister. Use check_calendar before proposing times.",
      "Use book_viewing only after the lister confirms a specific time.",
      `Active thread ID: ${threadId}`,
      context,
      `Instruction: ${instruction}`,
    ].join("\n\n");

    await session.prompt(prompt);
    session.dispose();
  }
}
