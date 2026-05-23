import { Hono } from "hono";
import type { AppDeps } from "../../app.ts";

export function createTextbeltWebhookRoutes(deps: AppDeps) {
  const app = new Hono();

  app.post("/sms", async (c) => {
    const body = await c.req.json<{
      textId: string;
      fromNumber: string;
      text: string;
    }>();

    if (!body || !body.fromNumber || !body.text) {
      return c.text("Bad Request", 400);
    }

    const from = body.fromNumber;
    const text = body.text;

    console.log(`[textbelt webhook] Inbound from ${from}: ${text.slice(0, 80)}`);

    const view = await deps.orchestrator.handleInboundSms(from, text, body.textId);
    if (!view) {
      console.warn(`[textbelt webhook] No active thread for ${from}`);
      return c.text("No active thread", 404);
    }

    console.log(`[textbelt webhook] Thread ${view.thread.threadId} -> ${view.thread.status}`);
    return c.text("OK", 200);
  });

  return app;
}
