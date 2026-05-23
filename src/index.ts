import "./env.ts";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { createAppDeps, healthPayload } from "./app.ts";
import { loadConfig } from "./config.ts";
import { findAvailablePort } from "./port.ts";
import { createCorrespondenceRoutes } from "./routes/correspondence.ts";
import { createGoogleAuthRoutes } from "./routes/auth/google.ts";
import { createTwilioWebhookRoutes } from "./routes/webhooks/twilio.ts";
import type { AppDeps } from "./app.ts";

export function createServer(deps?: AppDeps) {
  const resolved = deps ?? createAppDeps(loadConfig());
  const app = new Hono();

  app.get("/health", (c) => c.json(healthPayload(resolved.config)));
  app.route("/correspondence", createCorrespondenceRoutes(resolved));
  app.route("/webhooks/twilio", createTwilioWebhookRoutes(resolved));
  app.route("/auth", createGoogleAuthRoutes(resolved));

  return app;
}

const config = loadConfig();
const app = createServer();

export default app;

const isDirectRun = process.argv[1]?.endsWith("index.ts");
if (isDirectRun) {
  const preferredPort = config.port;
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.warn(
      `Port ${preferredPort} is in use; started on :${port} instead.`,
    );
  }

  serve({ fetch: app.fetch, port }, (info) => {
    const address = info && typeof info === "object" && "port" in info ? info.port : port;
    console.log(`Javier correspondence server listening on :${address}`);
  });
}
