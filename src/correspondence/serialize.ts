import type { AppDeps } from "../app.ts";

export type ThreadView = Awaited<ReturnType<AppDeps["orchestrator"]["getThreadView"]>>;

export function serializeThreadView(view: ThreadView) {
  return {
    threadId: view.thread.threadId,
    listingId: view.thread.listingId,
    listerPhone: view.thread.listerPhone,
    listerName: view.thread.listerName,
    userId: view.thread.userId,
    status: view.thread.status,
    proposedViewingAt: view.thread.proposedViewingAt,
    calendarEventId: view.thread.calendarEventId,
    listingSummary: view.thread.listingSummary,
    errorMessage: view.thread.errorMessage,
    createdAt: view.thread.createdAt,
    updatedAt: view.thread.updatedAt,
    messages: view.messages.map((message) => ({
      messageId: message.messageId,
      direction: message.direction,
      body: message.body,
      sentAt: message.sentAt,
      twilioSid: message.twilioSid,
    })),
  };
}
