import type {
  CorrespondenceMessage,
  CorrespondenceStore,
  CorrespondenceThread,
  CreateThreadInput,
} from "../correspondence/types.ts";

export class FakeClickHouse implements CorrespondenceStore {
  readonly threads = new Map<string, CorrespondenceThread>();
  readonly messages = new Map<string, CorrespondenceMessage[]>();
  readonly calendarTokens = new Map<string, string>();

  async createThread(input: CreateThreadInput): Promise<CorrespondenceThread> {
    const now = new Date().toISOString();
    const thread: CorrespondenceThread = {
      threadId: crypto.randomUUID(),
      listingId: input.listingId,
      listerPhone: input.listerPhone,
      listerName: input.listerName ?? null,
      userId: input.userId,
      status: "initiated",
      proposedViewingAt: null,
      calendarEventId: null,
      listingSummary: input.listingSummary ?? null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };
    this.threads.set(thread.threadId, thread);
    this.messages.set(thread.threadId, []);
    return thread;
  }

  async getThread(threadId: string): Promise<CorrespondenceThread | null> {
    return this.threads.get(threadId) ?? null;
  }

  async findActiveThreadByPhone(
    phone: string,
  ): Promise<CorrespondenceThread | null> {
    let latest: CorrespondenceThread | null = null;
    for (const thread of this.threads.values()) {
      if (
        thread.listerPhone === phone &&
        thread.status !== "completed" &&
        thread.status !== "failed"
      ) {
        if (
          !latest ||
          new Date(thread.updatedAt).getTime() >
            new Date(latest.updatedAt).getTime()
        ) {
          latest = thread;
        }
      }
    }
    return latest;
  }

  async listThreads(filters: {
    listingId?: string;
    userId?: string;
  }): Promise<CorrespondenceThread[]> {
    return [...this.threads.values()].filter((thread) => {
      if (filters.listingId && thread.listingId !== filters.listingId) {
        return false;
      }
      if (filters.userId && thread.userId !== filters.userId) {
        return false;
      }
      return true;
    });
  }

  async updateThread(
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
  ): Promise<CorrespondenceThread> {
    const existing = this.threads.get(threadId);
    if (!existing) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    const updated: CorrespondenceThread = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.threads.set(threadId, updated);
    return updated;
  }

  async addMessage(
    threadId: string,
    direction: CorrespondenceMessage["direction"],
    body: string,
    twilioSid?: string | null,
  ): Promise<CorrespondenceMessage> {
    const message: CorrespondenceMessage = {
      messageId: crypto.randomUUID(),
      threadId,
      direction,
      body,
      twilioSid: twilioSid ?? null,
      sentAt: new Date().toISOString(),
    };
    const list = this.messages.get(threadId) ?? [];
    list.push(message);
    this.messages.set(threadId, list);
    return message;
  }

  async getMessages(threadId: string): Promise<CorrespondenceMessage[]> {
    return this.messages.get(threadId) ?? [];
  }

  async saveCalendarToken(userId: string, refreshToken: string): Promise<void> {
    this.calendarTokens.set(userId, refreshToken);
  }

  async getCalendarToken(userId: string): Promise<string | null> {
    return this.calendarTokens.get(userId) ?? null;
  }
}
