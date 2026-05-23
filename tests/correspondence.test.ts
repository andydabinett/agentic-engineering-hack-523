import { describe, expect, it } from "vitest";

import { ScriptedCorrespondenceAgent } from "../src/agent/runner.ts";
import { FakeCalendarProvider } from "../src/services/calendar/provider.ts";
import { FakeClickHouse } from "../src/services/clickhouse/fake.ts";
import { CorrespondenceOrchestrator } from "../src/services/correspondence/orchestrator.ts";
import { FakeSmsProvider } from "../src/services/sms/provider.ts";

function createTestOrchestrator() {
  const store = new FakeClickHouse();
  const sms = new FakeSmsProvider();
  const calendar = new FakeCalendarProvider();
  const agent = new ScriptedCorrespondenceAgent();
  const orchestrator = new CorrespondenceOrchestrator(store, sms, calendar, agent);
  return { store, sms, calendar, orchestrator };
}

describe("CorrespondenceOrchestrator", () => {
  it("starts a thread and sends first SMS autonomously", async () => {
    const { sms, orchestrator } = createTestOrchestrator();
    const view = await orchestrator.start({
      listingId: "listing-1",
      listerPhone: "+15551234567",
      listerName: "Alex",
      userId: "user-1",
      listingSummary: "1BR in Bushwick, $2400",
    });

    expect(view.thread.status).toBe("awaiting_lister_reply");
    expect(view.messages).toHaveLength(1);
    expect(view.messages[0]?.direction).toBe("outbound");
    expect(sms.sent).toHaveLength(1);
    expect(sms.sent[0]?.to).toBe("+15551234567");
  });

  it("handles inbound confirmation and completes with calendar event", async () => {
    const { calendar, orchestrator } = createTestOrchestrator();
    const started = await orchestrator.start({
      listingId: "listing-1",
      listerPhone: "+15551234567",
      userId: "user-1",
    });

    const replied = await orchestrator.handleInboundSms(
      "+15551234567",
      "Yes, tomorrow at 2pm works for me",
      "SM_in_1",
    );

    expect(replied).not.toBeNull();
    expect(replied!.thread.status).toBe("completed");
    expect(replied!.thread.calendarEventId).toBeTruthy();
    expect(calendar.events).toHaveLength(1);
    expect(replied!.messages.some((m) => m.direction === "inbound")).toBe(true);
  });

  it("marks thread failed when SMS send fails", async () => {
    const { sms, orchestrator } = createTestOrchestrator();
    sms.failNext = true;

    await expect(
      orchestrator.start({
        listingId: "listing-1",
        listerPhone: "+15551234567",
        userId: "user-1",
      }),
    ).rejects.toThrow("Fake SMS send failure");

    const threads = await orchestrator.listThreads({ userId: "user-1" });
    expect(threads[0]?.thread.status).toBe("failed");
  });

  it("handles inbound when store status lags at initiated", async () => {
    const store = new FakeClickHouse();
    const sms = new FakeSmsProvider();
    const calendar = new FakeCalendarProvider();
    const agent = new ScriptedCorrespondenceAgent();
    const orchestrator = new CorrespondenceOrchestrator(store, sms, calendar, agent);

    const originalGetThread = store.getThread.bind(store);
    store.getThread = async (threadId) => {
      const thread = await originalGetThread(threadId);
      if (!thread) return null;
      const messages = await store.getMessages(threadId);
      if (
        thread.status === "awaiting_lister_reply" &&
        messages.some((m) => m.direction === "outbound")
      ) {
        return { ...thread, status: "initiated" };
      }
      return thread;
    };

    await orchestrator.start({
      listingId: "listing-1",
      listerPhone: "+15551234567",
      userId: "user-1",
    });

    const replied = await orchestrator.handleInboundSms(
      "+15551234567",
      "Hi Javier — yes, the unit is still available. I could do Saturday afternoon for a showing.",
      "SM_in_demo",
    );

    expect(replied).not.toBeNull();
    expect(replied!.messages.filter((m) => m.direction === "outbound")).toHaveLength(2);
    expect(replied!.messages.some((m) => m.body.includes("scheduled the viewing"))).toBe(true);
  });
});
