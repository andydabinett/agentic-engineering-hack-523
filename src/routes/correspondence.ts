import { Hono } from "hono";

import type { AppDeps } from "../app.ts";

function serializeThreadView(view: Awaited<ReturnType<AppDeps["orchestrator"]["getThreadView"]>>) {
  return {
    threadId: view.thread.threadId,
    listingId: view.thread.listingId,
    listerPhone: view.thread.listerPhone,
    listerName: view.thread.listerName,
    userId: view.thread.userId,
    status: view.thread.status,
    proposedViewingAt: view.thread.proposedViewingAt,
    calendarEventId: view.thread.calendarEventId,
    listingSummary: view.thread.listingSummary,
    errorMessage: view.thread.errorMessage,
    createdAt: view.thread.createdAt,
    updatedAt: view.thread.updatedAt,
    messages: view.messages.map((message) => ({
      messageId: message.messageId,
      direction: message.direction,
      body: message.body,
      sentAt: message.sentAt,
      twilioSid: message.twilioSid,
    })),
  };
}

export function createCorrespondenceRoutes(deps: AppDeps) {
  const app = new Hono();

  app.post("/start", async (c) => {
    const body = await c.req.json<{
      listingId: string;
      listerPhone: string;
      listerName?: string;
      userId: string;
      listingSummary?: string;
    }>();

    if (!body.listingId || !body.listerPhone || !body.userId) {
      return c.json({ error: "listingId, listerPhone, and userId are required" }, 400);
    }

    const view = await deps.orchestrator.start({
      listingId: body.listingId,
      listerPhone: body.listerPhone,
      listerName: body.listerName,
      userId: body.userId,
      listingSummary: body.listingSummary,
    });

    return c.json(serializeThreadView(view), 201);
  });

  app.get("/", async (c) => {
    const listingId = c.req.query("listingId");
    const userId = c.req.query("userId");
    const views = await deps.orchestrator.listThreads({ listingId, userId });
    return c.json(views.map(serializeThreadView));
  });

  app.get("/:threadId", async (c) => {
    try {
      const view = await deps.orchestrator.getThreadView(c.req.param("threadId"));
      return c.json(serializeThreadView(view));
    } catch {
      return c.json({ error: "Thread not found" }, 404);
    }
  });

  app.post("/:threadId/retry", async (c) => {
    try {
      const view = await deps.orchestrator.retry(c.req.param("threadId"));
      return c.json(serializeThreadView(view));
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Retry failed" },
        400,
      );
    }
  });

  return app;
}
