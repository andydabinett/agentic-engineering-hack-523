import type { CorrespondenceStatus } from "./state.ts";

export type MessageDirection = "outbound" | "inbound";

export interface CorrespondenceThread {
  threadId: string;
  listingId: string;
  listerPhone: string;
  listerName: string | null;
  userId: string;
  status: CorrespondenceStatus;
  proposedViewingAt: string | null;
  calendarEventId: string | null;
  listingSummary: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CorrespondenceMessage {
  messageId: string;
  threadId: string;
  direction: MessageDirection;
  body: string;
  twilioSid: string | null;
  sentAt: string;
}

export interface CreateThreadInput {
  listingId: string;
  listerPhone: string;
  listerName?: string | null;
  userId: string;
  listingSummary?: string | null;
}

export interface CorrespondenceStore {
  createThread(input: CreateThreadInput): Promise<CorrespondenceThread>;
  getThread(threadId: string): Promise<CorrespondenceThread | null>;
  findActiveThreadByPhone(phone: string): Promise<CorrespondenceThread | null>;
  listThreads(filters: {
    listingId?: string;
    userId?: string;
  }): Promise<CorrespondenceThread[]>;
  updateThread(
    threadId: string,
    patch: Partial<
      Pick<
        CorrespondenceThread,
        | "status"
        | "proposedViewingAt"
        | "calendarEventId"
        | "errorMessage"
        | "listerName"
      >
    >,
  ): Promise<CorrespondenceThread>;
  addMessage(
    threadId: string,
    direction: MessageDirection,
    body: string,
    twilioSid?: string | null,
  ): Promise<CorrespondenceMessage>;
  getMessages(threadId: string): Promise<CorrespondenceMessage[]>;
  saveCalendarToken(userId: string, refreshToken: string): Promise<void>;
  getCalendarToken(userId: string): Promise<string | null>;
}
