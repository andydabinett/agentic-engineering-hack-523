import { createAppDeps, type AppDeps } from "../app.ts";
import { loadConfig } from "../config.ts";
import { correspondenceFakeDemoEnabled } from "./fakeDemo.js";
import { normalizePhone } from "../services/sms/phone.ts";
import type { Config } from "../config.ts";
import {
  formatTwilioSendError,
  validateTwilioSignature,
} from "../services/sms/twilio.ts";
import { serializeThreadView } from "./serialize.ts";

function ensureOutreachSent(view: ReturnType<typeof serializeThreadView>): void {
  const hasOutbound = view.messages.some((m) => m.direction === "outbound");
  if (!hasOutbound && view.status === "initiated") {
    throw new Error(
      "Outreach did not send an SMS. Local dev uses the scripted agent by default; set CORRESPONDENCE_USE_PI_AGENT=1 only when OpenRouter is configured for the LLM agent.",
    );
  }
}

let depsPromise: Promise<AppDeps> | null = null;

export async function getCorrespondenceDeps(): Promise<AppDeps> {
  if (!depsPromise) {
    depsPromise = Promise.resolve(createAppDeps(loadConfig()));
  }
  return depsPromise;
}

export async function startCorrespondenceThread(input: {
  listingId: string;
  listerPhone: string;
  listerName?: string;
  userId?: string;
  listingSummary?: string;
}) {
  const listerPhone = normalizePhone(input.listerPhone);
  if (!listerPhone) {
    throw new Error("Lister phone is required to start correspondence.");
  }

  const { orchestrator } = await getCorrespondenceDeps();
  try {
    const view = await orchestrator.start({
      ...input,
      listerPhone,
      userId: input.userId ?? "web-user",
    });
    const serialized = serializeThreadView(view);
    ensureOutreachSent(serialized);
    return serialized;
  } catch (error) {
    throw new Error(formatTwilioSendError(error));
  }
}

export async function getCorrespondenceThreadView(threadId: string) {
  const { orchestrator } = await getCorrespondenceDeps();
  const view = await orchestrator.getThreadView(threadId);
  return serializeThreadView(view);
}

export async function listCorrespondenceThreadViews(filters: {
  listingId?: string;
  userId?: string;
}) {
  const { orchestrator } = await getCorrespondenceDeps();
  const views = await orchestrator.listThreads({
    listingId: filters.listingId,
    userId: filters.userId ?? "web-user",
  });
  return views.map(serializeThreadView);
}

export async function simulateCorrespondenceThreadReply(threadId: string, body: string) {
  const deps = await getCorrespondenceDeps();
  if (!deps.config.correspondenceDev) {
    throw new Error("Dev routes disabled. Set CORRESPONDENCE_DEV=1.");
  }
  const view = await deps.orchestrator.simulateInboundReply(threadId, body.trim());
  return serializeThreadView(view);
}

export async function processTwilioSmsWebhook(input: {
  params: Record<string, string>;
  signature?: string | null;
  webhookUrl: string;
}): Promise<{ status: number; body: string }> {
  const deps = await getCorrespondenceDeps();
  const valid = validateTwilioSignature(
    deps.config,
    input.signature ?? undefined,
    input.webhookUrl,
    input.params,
  );

  if (deps.config.twilioAuthToken && !valid) {
    console.warn(
      `[twilio webhook] Invalid signature for URL ${input.webhookUrl}`,
    );
    return { status: 403, body: "Invalid Twilio signature" };
  }

  const from = normalizePhone(input.params.From ?? "");
  const body = input.params.Body;
  const messageSid = input.params.MessageSid;

  if (!from || !body) {
    return { status: 400, body: "Missing From or Body" };
  }

  console.log(`[twilio webhook] Inbound from ${from}: ${body.slice(0, 80)}`);

  const view = await deps.orchestrator.handleInboundSms(from, body, messageSid);
  if (!view) {
    console.warn(`[twilio webhook] No active thread for ${from}`);
    return { status: 404, body: "No active thread for sender" };
  }

  console.log(`[twilio webhook] Thread ${view.thread.threadId} -> ${view.thread.status}`);
  return { status: 200, body: "" };
}

export function correspondenceDevEnabled(): boolean {
  const config = loadConfig();
  return config.correspondenceDev;
}

export { correspondenceFakeDemoEnabled } from "./fakeDemo.js";

export function twilioWebhookUrlFromRequest(
  config: Config,
  headers: { get(name: string): string | null },
  path = "/api/webhooks/twilio/sms",
): string {
  const forwardedHost = headers.get("X-Forwarded-Host") ?? headers.get("x-forwarded-host");
  const forwardedProto =
    headers.get("X-Forwarded-Proto") ?? headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}${path}`;
  }
  const host = headers.get("Host") ?? headers.get("host");
  if (host && !host.startsWith("localhost")) {
    const proto =
      headers.get("X-Forwarded-Proto") ?? headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}${path}`;
  }
  return `${config.publicBaseUrl.replace(/\/$/, "")}${path.replace("/api", "")}`;
}
