import { Hono } from "hono";

import type { AppDeps } from "../../app.ts";
import {
  exchangeGoogleCode,
  getGoogleAuthUrl,
} from "../../services/calendar/google.ts";

export function createGoogleAuthRoutes(deps: AppDeps) {
  const app = new Hono();

  app.get("/google", (c) => {
    const userId = c.req.query("userId") ?? "demo-user";
    if (!deps.config.googleClientId || !deps.config.googleClientSecret) {
      return c.json({ error: "Google OAuth is not configured" }, 503);
    }
    const url = getGoogleAuthUrl(deps.config, userId);
    return c.redirect(url);
  });

  app.get("/google/callback", async (c) => {
    const code = c.req.query("code");
    const userId = c.req.query("state") ?? "demo-user";
    if (!code) {
      return c.json({ error: "Missing OAuth code" }, 400);
    }

    try {
      const refreshToken = await exchangeGoogleCode(deps.config, code);
      await deps.store.saveCalendarToken(userId, refreshToken);
      return c.json({ status: "connected", userId });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "OAuth failed" },
        500,
      );
    }
  });

  return app;
}
