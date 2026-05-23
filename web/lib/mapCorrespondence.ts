import type {
  Conversation,
  ConversationStatus,
  Listing,
  ListingStatus,
  Message,
  Viewing,
} from "./types";

export interface CorrespondenceMessage {
  messageId: string;
  direction: "inbound" | "outbound";
  body: string;
  sentAt: string;
  twilioSid?: string | null;
}

export interface CorrespondenceThreadView {
  threadId: string;
  listingId: string;
  listerPhone: string;
  listerName?: string | null;
  userId: string;
  status: string;
  proposedViewingAt?: string | null;
  calendarEventId?: string | null;
  listingSummary?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: CorrespondenceMessage[];
}

const TERMINAL = new Set(["completed", "failed"]);

export function isCorrespondenceTerminal(status: string): boolean {
  return TERMINAL.has(status);
}

export function correspondenceToListingStatus(status: string): ListingStatus {
  switch (status) {
    case "initiated":
    case "outreach_sent":
      return "contacted";
    case "awaiting_lister_reply":
    case "negotiating_time":
    case "viewing_proposed":
    case "needs_user_input":
      return "awaiting";
    case "viewing_confirmed":
    case "calendar_event_created":
      return "scheduled";
    case "completed":
      return "complete";
    case "failed":
      return "matched";
    default:
      return "awaiting";
  }
}

export function correspondenceToConversationStatus(status: string): ConversationStatus {
  switch (status) {
    case "viewing_confirmed":
    case "calendar_event_created":
    case "completed":
      return "scheduled";
    case "failed":
      return "awaiting";
    default:
      return "awaiting";
  }
}

export function mapCorrespondenceMessages(messages: CorrespondenceMessage[]): Message[] {
  return messages.map((message) => ({
    id: message.messageId,
    from: message.direction === "outbound" ? "agent" : "broker",
    body: message.body,
    timestamp: new Date(message.sentAt),
    receipt: message.direction === "outbound" ? "delivered" : undefined,
  }));
}

export function mapCorrespondenceToConversation(
  view: CorrespondenceThreadView,
  listing?: Pick<Listing, "brokerName" | "brokerPhone" | "address">,
): Conversation {
  const messages = mapCorrespondenceMessages(view.messages);
  const lastUpdated =
    messages.length > 0
      ? messages[messages.length - 1].timestamp
      : new Date(view.updatedAt);

  return {
    id: `conv-${view.threadId}`,
    correspondenceThreadId: view.threadId,
    listingId: view.listingId,
    brokerName: view.listerName || listing?.brokerName || "Broker",
    brokerPhone: view.listerPhone || listing?.brokerPhone || "",
    messages,
    status: correspondenceToConversationStatus(view.status),
    lastUpdated,
    unread: view.status === "awaiting_lister_reply",
  };
}

export function correspondenceToViewing(
  view: CorrespondenceThreadView,
  listing?: Pick<Listing, "address" | "brokerName">,
): Viewing | null {
  if (!view.proposedViewingAt) return null;
  const startTime = new Date(view.proposedViewingAt);
  if (Number.isNaN(startTime.getTime())) return null;

  const endTime = new Date(startTime.getTime() + 30 * 60_000);
  return {
    id: view.calendarEventId || `viewing-${view.threadId}`,
    listingId: view.listingId,
    address: listing?.address || view.listingSummary || "Viewing",
    brokerName: view.listerName || listing?.brokerName || "Broker",
    startTime,
    endTime,
  };
}
