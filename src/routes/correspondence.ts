import { Hono } from "hono";

import type { AppDeps } from "../app.ts";
import { serializeThreadView } from "../correspondence/serialize.ts";

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

  app.post("/:threadId/simulate-reply", async (c) => {
    if (!deps.config.correspondenceDev) {
      return c.json({ error: "Dev routes disabled. Set CORRESPONDENCE_DEV=1." }, 404);
    }

    const body = await c.req.json<{ body?: string }>();
    if (!body.body?.trim()) {
      return c.json({ error: "body is required" }, 400);
    }

    try {
      const view = await deps.orchestrator.simulateInboundReply(
        c.req.param("threadId"),
        body.body.trim(),
      );
      return c.json(serializeThreadView(view));
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Simulate reply failed" },
        400,
      );
    }
  });

  return app;
}
