import { describe, expect, it } from "vitest";

import { parseNgrokResponse, pickNgrokTunnel } from "../src/tunnel/ngrok.ts";
import { twilioSmsWebhookUrl } from "../src/services/sms/sync-webhook.ts";

describe("ngrok tunnel helpers", () => {
  it("prefers https tunnel", () => {
    const tunnel = pickNgrokTunnel([
      { publicUrl: "http://abc.ngrok-free.app", proto: "http" },
      { publicUrl: "https://abc.ngrok-free.app", proto: "https" },
    ]);

    expect(tunnel?.publicUrl).toBe("https://abc.ngrok-free.app");
  });

  it("parses ngrok API response", () => {
    const tunnels = parseNgrokResponse({
      tunnels: [{ public_url: "https://abc.ngrok-free.app/", proto: "https" }],
    });

    expect(tunnels).toEqual([
      { publicUrl: "https://abc.ngrok-free.app", proto: "https" },
    ]);
  });
});

describe("Twilio webhook URL builder", () => {
  it("builds sms webhook path", () => {
    expect(twilioSmsWebhookUrl("https://abc.ngrok-free.app/")).toBe(
      "https://abc.ngrok-free.app/webhooks/twilio/sms",
    );
  });
});
