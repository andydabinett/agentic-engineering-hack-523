import { createClient, type ClickHouseClient } from "@clickhouse/client";

import type { Config } from "../../config.ts";
import type {
  CorrespondenceMessage,
  CorrespondenceStore,
  CorrespondenceThread,
  CreateThreadInput,
} from "../correspondence/types.ts";
import type { CorrespondenceStatus } from "../correspondence/state.ts";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapThread(row: Record<string, unknown>): CorrespondenceThread {
  return {
    threadId: String(row.thread_id),
    listingId: String(row.listing_id),
    listerPhone: String(row.lister_phone),
    listerName: row.lister_name ? String(row.lister_name) : null,
    userId: String(row.user_id),
    status: String(row.status) as CorrespondenceStatus,
    proposedViewingAt: row.proposed_viewing_at
      ? toIso(String(row.proposed_viewing_at))
      : null,
    calendarEventId: row.calendar_event_id
      ? String(row.calendar_event_id)
      : null,
    listingSummary: row.listing_summary ? String(row.listing_summary) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: toIso(String(row.created_at)),
    updatedAt: toIso(String(row.updated_at)),
  };
}

function mapMessage(row: Record<string, unknown>): CorrespondenceMessage {
  return {
    messageId: String(row.message_id),
    threadId: String(row.thread_id),
    direction: row.direction as CorrespondenceMessage["direction"],
    body: String(row.body),
    twilioSid: row.twilio_sid ? String(row.twilio_sid) : null,
    sentAt: toIso(String(row.sent_at)),
  };
}

export function createClickHouseClient(config: Config): ClickHouseClient {
  return createClient({
    url: `${config.clickhouseSecure ? "https" : "http"}://${config.clickhouseHost}:${config.clickhousePort}`,
    username: config.clickhouseUser,
    password: config.clickhousePassword,
    database: config.clickhouseDatabase,
  });
}

export class ClickHouseCorrespondenceStore implements CorrespondenceStore {
  /** In-process cache — ClickHouse ReplacingMergeTree reads can lag behind inserts. */
  private readonly threadCache = new Map<string, CorrespondenceThread>();

  constructor(
    private readonly client: ClickHouseClient,
    private readonly database: string,
  ) {}

  private cacheThread(thread: CorrespondenceThread): CorrespondenceThread {
    this.threadCache.set(thread.threadId, thread);
    return thread;
  }

  private async queryThread(threadId: string): Promise<CorrespondenceThread | null> {
    const result = await this.client.query({
      query: `
        SELECT *
        FROM ${this.database}.correspondence_threads FINAL
        WHERE thread_id = {threadId:UUID}
        LIMIT 1
      `,
      query_params: { threadId },
      format: "JSONEachRow",
    });
    const rows = (await result.json()) as Record<string, unknown>[];
    return rows[0] ? mapThread(rows[0]) : null;
  }

  async createThread(input: CreateThreadInput): Promise<CorrespondenceThread> {
    const now = new Date();
    const threadId = crypto.randomUUID();
    const row = {
      thread_id: threadId,
      listing_id: input.listingId,
      lister_phone: input.listerPhone,
      lister_name: input.listerName ?? null,
      user_id: input.userId,
      status: "initiated",
      proposed_viewing_at: null,
      calendar_event_id: null,
      listing_summary: input.listingSummary ?? null,
      error_message: null,
      created_at: now,
      updated_at: now,
    };
    await this.client.insert({
      table: `${this.database}.correspondence_threads`,
      values: [row],
      format: "JSONEachRow",
    });
    return this.cacheThread(mapThread(row));
  }

  async getThread(threadId: string): Promise<CorrespondenceThread | null> {
    const cached = this.threadCache.get(threadId);
    if (cached) return cached;
    const thread = await this.queryThread(threadId);
    if (thread) this.threadCache.set(threadId, thread);
    return thread;
  }

  async findActiveThreadByPhone(
    phone: string,
  ): Promise<CorrespondenceThread | null> {
    const result = await this.client.query({
      query: `
        SELECT *
        FROM ${this.database}.correspondence_threads FINAL
        WHERE lister_phone = {phone:String}
          AND status NOT IN ('completed', 'failed')
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      query_params: { phone },
      format: "JSONEachRow",
    });
    const rows = (await result.json()) as Record<string, unknown>[];
    return rows[0] ? mapThread(rows[0]) : null;
  }

  async listThreads(filters: {
    listingId?: string;
    userId?: string;
  }): Promise<CorrespondenceThread[]> {
    const clauses: string[] = [];
    const params: Record<string, string> = {};
    if (filters.listingId) {
      clauses.push("listing_id = {listingId:String}");
      params.listingId = filters.listingId;
    }
    if (filters.userId) {
      clauses.push("user_id = {userId:String}");
      params.userId = filters.userId;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await this.client.query({
      query: `
        SELECT *
        FROM ${this.database}.correspondence_threads FINAL
        ${where}
        ORDER BY updated_at DESC
      `,
      query_params: params,
      format: "JSONEachRow",
    });
    const rows = (await result.json()) as Record<string, unknown>[];
    return rows.map(mapThread);
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
    const existing = await this.getThread(threadId);
    if (!existing) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    const now = new Date();
    const row = {
      thread_id: threadId,
      listing_id: existing.listingId,
      lister_phone: existing.listerPhone,
      lister_name: patch.listerName ?? existing.listerName,
      user_id: existing.userId,
      status: patch.status ?? existing.status,
      proposed_viewing_at: patch.proposedViewingAt
        ? new Date(patch.proposedViewingAt)
        : existing.proposedViewingAt
          ? new Date(existing.proposedViewingAt)
          : null,
      calendar_event_id: patch.calendarEventId ?? existing.calendarEventId,
      listing_summary: existing.listingSummary,
      error_message: patch.errorMessage ?? existing.errorMessage,
      created_at: new Date(existing.createdAt),
      updated_at: now,
    };
    await this.client.insert({
      table: `${this.database}.correspondence_threads`,
      values: [row],
      format: "JSONEachRow",
    });
    return this.cacheThread(mapThread(row));
  }

  async addMessage(
    threadId: string,
    direction: CorrespondenceMessage["direction"],
    body: string,
    twilioSid?: string | null,
  ): Promise<CorrespondenceMessage> {
    const row = {
      message_id: crypto.randomUUID(),
      thread_id: threadId,
      direction,
      body,
      twilio_sid: twilioSid ?? null,
      sent_at: new Date(),
    };
    await this.client.insert({
      table: `${this.database}.correspondence_messages`,
      values: [row],
      format: "JSONEachRow",
    });
    return mapMessage(row);
  }

  async getMessages(threadId: string): Promise<CorrespondenceMessage[]> {
    const result = await this.client.query({
      query: `
        SELECT *
        FROM ${this.database}.correspondence_messages
        WHERE thread_id = {threadId:UUID}
        ORDER BY sent_at ASC, direction ASC, message_id ASC
      `,
      query_params: { threadId },
      format: "JSONEachRow",
    });
    const rows = (await result.json()) as Record<string, unknown>[];
    return rows.map(mapMessage);
  }

  async saveCalendarToken(userId: string, refreshToken: string): Promise<void> {
    await this.client.insert({
      table: `${this.database}.user_calendar_tokens`,
      values: [{ user_id: userId, refresh_token: refreshToken, updated_at: new Date() }],
      format: "JSONEachRow",
    });
  }

  async getCalendarToken(userId: string): Promise<string | null> {
    const result = await this.client.query({
      query: `
        SELECT refresh_token
        FROM ${this.database}.user_calendar_tokens FINAL
        WHERE user_id = {userId:String}
        LIMIT 1
      `,
      query_params: { userId },
      format: "JSONEachRow",
    });
    const rows = (await result.json()) as Array<{ refresh_token: string }>;
    return rows[0]?.refresh_token ?? null;
  }
}
