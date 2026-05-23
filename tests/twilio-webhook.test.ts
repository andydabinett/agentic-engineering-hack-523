import twilio from "twilio";
import { describe, expect, it } from "vitest";

import { createServer } from "../src/index.ts";
import { loadConfig } from "../src/config.ts";
import { FakeClickHouse } from "../src/services/clickhouse/fake.ts";
import { FakeSmsProvider } from "../src/services/sms/provider.ts";
import { FakeCalendarProvider } from "../src/services/calendar/provider.ts";
import { CorrespondenceOrchestrator } from "../src/services/correspondence/orchestrator.ts";
import { ScriptedCorrespondenceAgent } from "../src/agent/runner.ts";

describe("Twilio webhook route", () => {
  it("accepts inbound SMS for an active thread", async () => {
    const config = loadConfig();
    const store = new FakeClickHouse();
    const sms = new FakeSmsProvider();
    const calendar = new FakeCalendarProvider();
    const agent = new ScriptedCorrespondenceAgent();
    const orchestrator = new CorrespondenceOrchestrator(store, sms, calendar, agent);

    await orchestrator.start({
      listingId: "listing-1",
      listerPhone: "+15551234567",
      userId: "user-1",
    });

    const testConfig = {
      ...config,
      twilioAuthToken: "test_auth_token",
      publicBaseUrl: "http://localhost:3000",
    };

    const app = createServer({
      config: testConfig,
      store,
      sms,
      calendar,
      orchestrator,
    });

    const params = {
      From: "+15551234567",
      To: "+18779166745",
      Body: "Maybe Saturday afternoon?",
      MessageSid: "SM123",
    };

    const url = "http://localhost:3000/webhooks/twilio/sms";
    const signature = twilio.getExpectedTwilioSignature(
      testConfig.twilioAuthToken!,
      url,
      params,
    );

    const body = new URLSearchParams(params);
    const response = await app.request("http://localhost/webhooks/twilio/sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Twilio-Signature": signature,
      },
      body,
    });

    expect(response.status).toBe(200);
    const thread = await store.findActiveThreadByPhone("+15551234567");
    expect(thread?.status).not.toBe("initiated");
  });

  it("returns 403 for invalid signature when auth token configured", async () => {
    const config = loadConfig();
    const store = new FakeClickHouse();
    const sms = new FakeSmsProvider();
    const calendar = new FakeCalendarProvider();
    const agent = new ScriptedCorrespondenceAgent();
    const orchestrator = new CorrespondenceOrchestrator(store, sms, calendar, agent);

    const testConfig = {
      ...config,
      twilioAuthToken: "test_auth_token",
      publicBaseUrl: "http://localhost:3000",
    };

    const app = createServer({
      config: testConfig,
      store,
      sms,
      calendar,
      orchestrator,
    });

    const response = await app.request("http://localhost/webhooks/twilio/sms", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        From: "+15551234567",
        Body: "Hello",
      }),
    });

    expect(response.status).toBe(403);
  });
});

describe("Correspondence HTTP routes", () => {
  it("POST /correspondence/start creates a thread", async () => {
    const store = new FakeClickHouse();
    const sms = new FakeSmsProvider();
    const calendar = new FakeCalendarProvider();
    const orchestrator = new CorrespondenceOrchestrator(
      store,
      sms,
      calendar,
      new ScriptedCorrespondenceAgent(),
    );
    const app = createServer({
      config: loadConfig(),
      store,
      sms,
      calendar,
      orchestrator,
    });

    const response = await app.request("http://localhost/correspondence/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId: "abc",
        listerPhone: "+15551234567",
        userId: "user-1",
      }),
    });

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.status).toBe("awaiting_lister_reply");
    expect(json.messages.length).toBeGreaterThan(0);
  });
});
