import { normalizePhone } from "../sms/phone.ts";
import {
  assertTransition,
  statusAfterInbound,
  statusAfterOutbound,
} from "./state.ts";
import type {
  CorrespondenceMessage,
  CorrespondenceStore,
  CorrespondenceThread,
  CreateThreadInput,
} from "./types.ts";
import type { SmsProvider } from "../sms/provider.ts";
import type { CalendarProvider } from "../calendar/provider.ts";
import type { CorrespondenceAgentRunner } from "../../agent/runner.ts";

export interface StartCorrespondenceInput extends CreateThreadInput {}

export interface ThreadView {
  thread: CorrespondenceThread;
  messages: CorrespondenceMessage[];
}

export class CorrespondenceOrchestrator {
  constructor(
    private readonly store: CorrespondenceStore,
    private readonly sms: SmsProvider,
    private readonly calendar: CalendarProvider,
    private readonly agent: CorrespondenceAgentRunner,
  ) {}

  async start(input: StartCorrespondenceInput): Promise<ThreadView> {
    const thread = await this.store.createThread({
      ...input,
      listerPhone: normalizePhone(input.listerPhone),
    });
    await this.runAgent(thread.threadId, "Start outreach to schedule a viewing.");
    return this.getThreadView(thread.threadId);
  }

  async simulateInboundReply(threadId: string, body: string): Promise<ThreadView> {
    const thread = await this.store.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const view = await this.handleInboundSms(
      thread.listerPhone,
      body,
      `sim-${crypto.randomUUID()}`,
    );
    if (!view) {
      throw new Error("Thread is not active");
    }
    return view;
  }

  async handleInboundSms(from: string, body: string, twilioSid?: string): Promise<ThreadView | null> {
    const thread = await this.store.findActiveThreadByPhone(normalizePhone(from));
    if (!thread) {
      return null;
    }

    await this.store.addMessage(thread.threadId, "inbound", body, twilioSid);
    const inboundStatus = statusAfterInbound(body);
    await this.transition(thread.threadId, inboundStatus);

    await this.runAgent(
      thread.threadId,
      `The lister replied: "${body}". Continue coordinating the viewing.`,
    );
    return this.getThreadView(thread.threadId);
  }

  async getThreadView(threadId: string): Promise<ThreadView> {
    const thread = await this.store.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    const messages = await this.store.getMessages(threadId);
    return { thread, messages };
  }

  async listThreads(filters: {
    listingId?: string;
    userId?: string;
  }): Promise<ThreadView[]> {
    const threads = await this.store.listThreads(filters);
    return Promise.all(threads.map((thread) => this.getThreadView(thread.threadId)));
  }

  async retry(threadId: string): Promise<ThreadView> {
    const thread = await this.store.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    if (thread.status !== "failed") {
      throw new Error("Only failed threads can be retried");
    }
    await this.transition(threadId, "initiated");
    await this.runAgent(threadId, "Retry outreach to schedule a viewing.");
    return this.getThreadView(threadId);
  }

  async sendSms(threadId: string, body: string): Promise<CorrespondenceMessage> {
    const thread = await this.store.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const trimmed = body.trim().slice(0, 320);
    if (!trimmed) {
      throw new Error("SMS body cannot be empty");
    }

    try {
      const result = await this.sms.send(thread.listerPhone, trimmed);
      const message = await this.store.addMessage(
        threadId,
        "outbound",
        trimmed,
        result.sid,
      );
      const messages = await this.store.getMessages(threadId);
      const outboundCount = messages.filter((m) => m.direction === "outbound").length;
      const nextStatus = statusAfterOutbound(
        thread.status,
        outboundCount === 1,
        trimmed,
      );
      await this.transition(threadId, nextStatus);
      if (nextStatus === "outreach_sent") {
        await this.transition(threadId, "awaiting_lister_reply");
      }
      return message;
    } catch (error) {
      await this.fail(threadId, error instanceof Error ? error.message : "SMS send failed");
      throw error;
    }
  }

  async checkCalendar(
    threadId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<Array<{ start: string; end: string }>> {
    const thread = await this.store.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    return this.calendar.getFreeBusy(thread.userId, timeMin, timeMax);
  }

  async bookViewing(
    threadId: string,
    input: {
      start: string;
      end: string;
      title: string;
      location?: string;
      description?: string;
    },
  ): Promise<{ eventId: string; htmlLink?: string }> {
    const thread = await this.store.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const event = await this.calendar.createEvent(thread.userId, {
      title: input.title,
      start: input.start,
      end: input.end,
      location: input.location,
      description: input.description,
    });

    await this.store.updateThread(threadId, {
      proposedViewingAt: input.start,
      calendarEventId: event.id,
      status: "calendar_event_created",
    });
    await this.transition(threadId, "completed");
    return { eventId: event.id, htmlLink: event.htmlLink };
  }

  async getThreadContext(threadId: string): Promise<string> {
    const { thread, messages } = await this.getThreadView(threadId);
    const transcript = messages
      .map((m) => `${m.direction.toUpperCase()}: ${m.body}`)
      .join("\n");
    return [
      `Thread ${thread.threadId}`,
      `Listing: ${thread.listingId}`,
      thread.listingSummary ? `Summary: ${thread.listingSummary}` : "",
      `Lister: ${thread.listerName ?? "unknown"} (${thread.listerPhone})`,
      `Status: ${thread.status}`,
      transcript ? `Messages:\n${transcript}` : "No messages yet.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  private async transition(
    threadId: string,
    to: CorrespondenceThread["status"],
  ): Promise<void> {
    const thread = await this.store.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    if (thread.status === to) {
      return;
    }
    assertTransition(thread.status, to);
    await this.store.updateThread(threadId, { status: to });
  }

  private async fail(threadId: string, message: string): Promise<void> {
    const thread = await this.store.getThread(threadId);
    if (!thread) {
      return;
    }
    if (thread.status === "failed") {
      return;
    }
    await this.store.updateThread(threadId, {
      status: "failed",
      errorMessage: message,
    });
  }

  private async runAgent(threadId: string, instruction: string): Promise<void> {
    try {
      await this.agent.run(this, threadId, instruction);
    } catch (error) {
      await this.fail(
        threadId,
        error instanceof Error ? error.message : "Agent run failed",
      );
      throw error;
    }
  }
}
