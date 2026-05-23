import { Hono } from "hono";

import type { AppDeps } from "../../app.ts";
import { normalizePhone } from "../../services/sms/phone.ts";
import { validateTwilioSignature, webhookUrlFromRequest } from "../../services/sms/twilio.ts";

export function createTwilioWebhookRoutes(deps: AppDeps) {
  const app = new Hono();

  app.post("/sms", async (c) => {
    const form = await c.req.parseBody();
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(form)) {
      if (typeof value === "string") {
        params[key] = value;
      }
    }

    const signature = c.req.header("X-Twilio-Signature");
    const url = webhookUrlFromRequest(c, deps.config);
    const valid = validateTwilioSignature(deps.config, signature, url, params);

    if (deps.config.twilioAuthToken && !valid) {
      console.warn(
        `[twilio webhook] Invalid signature for URL ${url} (run npm run sync:twilio-webhook after ngrok restarts)`,
      );
      return c.text("Invalid Twilio signature", 403);
    }

    const from = normalizePhone(params.From ?? "");
    const body = params.Body;
    const messageSid = params.MessageSid;

    if (!from || !body) {
      return c.text("Missing From or Body", 400);
    }

    console.log(`[twilio webhook] Inbound from ${from}: ${body.slice(0, 80)}`);

    const view = await deps.orchestrator.handleInboundSms(from, body, messageSid);
    if (!view) {
      console.warn(`[twilio webhook] No active thread for ${from}`);
      return c.text("No active thread for sender", 404);
    }

    console.log(`[twilio webhook] Thread ${view.thread.threadId} -> ${view.thread.status}`);
    return c.text("", 200);
  });

  return app;
}
