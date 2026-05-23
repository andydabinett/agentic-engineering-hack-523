import { afterEach, describe, expect, it, vi } from "vitest";

import { resetRuntimeFakeDemoForTests } from "../src/correspondence/fakeDemo.js";
import { FakeSmsProvider, TwilioWithFakeFallbackSmsProvider } from "../src/services/sms/provider.ts";

describe("TwilioWithFakeFallbackSmsProvider", () => {
  afterEach(() => {
    resetRuntimeFakeDemoForTests();
  });

  it("falls back to fake SMS on Twilio overload errors", async () => {
    const twilio: FakeSmsProvider & { send: ReturnType<typeof vi.fn> } = {
      sent: [],
      failNext: false,
      send: vi.fn().mockRejectedValue(
        Object.assign(new Error("daily limit"), { code: 63038, status: 429 }),
      ),
    };
    const onFallback = vi.fn();
    const sms = new TwilioWithFakeFallbackSmsProvider(twilio, onFallback);

    const first = await sms.send("+15551234567", "Hello");
    expect(first.sid).toMatch(/^SM_fake_/);
    expect(onFallback).toHaveBeenCalledOnce();
    expect(twilio.send).toHaveBeenCalledOnce();

    twilio.send.mockClear();
    const second = await sms.send("+15551234567", "Follow up");
    expect(second.sid).toMatch(/^SM_fake_/);
    expect(twilio.send).not.toHaveBeenCalled();
  });

  it("rethrows non-overload Twilio errors", async () => {
    const twilio = {
      send: vi.fn().mockRejectedValue(new Error("invalid number")),
    };
    const sms = new TwilioWithFakeFallbackSmsProvider(twilio);

    await expect(sms.send("+15551234567", "Hello")).rejects.toThrow("invalid number");
  });
});

describe("correspondenceFakeDemoEnabled runtime flag", () => {
  afterEach(() => {
    resetRuntimeFakeDemoForTests();
    delete process.env.CORRESPONDENCE_FAKE_DEMO;
  });

  it("returns true when env or runtime fallback is active", async () => {
    const { activateRuntimeFakeDemo, correspondenceFakeDemoEnabled } = await import(
      "../src/correspondence/fakeDemo.js"
    );
    expect(correspondenceFakeDemoEnabled()).toBe(false);
    activateRuntimeFakeDemo("63038");
    expect(correspondenceFakeDemoEnabled()).toBe(true);
  });
});
