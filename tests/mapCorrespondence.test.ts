import { describe, expect, it } from "vitest";

import {
  correspondenceToListingStatus,
  mapCorrespondenceMessages,
  mapCorrespondenceToConversation,
} from "../web/lib/mapCorrespondence.ts";

describe("mapCorrespondence", () => {
  it("maps outbound/inbound messages to UI shape", () => {
    const messages = mapCorrespondenceMessages([
      {
        messageId: "m1",
        direction: "outbound",
        body: "Hi there",
        sentAt: "2026-05-23T12:00:00.000Z",
      },
      {
        messageId: "m2",
        direction: "inbound",
        body: "Saturday works",
        sentAt: "2026-05-23T12:05:00.000Z",
      },
    ]);

    expect(messages[0].from).toBe("agent");
    expect(messages[1].from).toBe("broker");
  });

  it("maps correspondence status to listing status", () => {
    expect(correspondenceToListingStatus("outreach_sent")).toBe("contacted");
    expect(correspondenceToListingStatus("awaiting_lister_reply")).toBe("awaiting");
    expect(correspondenceToListingStatus("viewing_confirmed")).toBe("scheduled");
  });

  it("builds conversation with thread id", () => {
    const conversation = mapCorrespondenceToConversation({
      threadId: "thread-1",
      listingId: "db-1",
      listerPhone: "+15551234567",
      listerName: "Alex",
      userId: "web-user",
      status: "awaiting_lister_reply",
      createdAt: "2026-05-23T12:00:00.000Z",
      updatedAt: "2026-05-23T12:00:00.000Z",
      messages: [],
    });

    expect(conversation.correspondenceThreadId).toBe("thread-1");
    expect(conversation.id).toBe("conv-thread-1");
  });
});
