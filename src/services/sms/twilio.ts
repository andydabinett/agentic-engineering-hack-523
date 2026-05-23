import twilio from "twilio";
import type { Context } from "hono";

import type { Config } from "../../config.ts";
import type { SmsProvider } from "./provider.ts";

export function webhookUrlFromRequest(c: Context, config: Config): string {
  const path = "/webhooks/twilio/sms";
  const forwardedHost = c.req.header("X-Forwarded-Host");
  const forwardedProto = c.req.header("X-Forwarded-Proto") ?? "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}${path}`;
  }
  const host = c.req.header("Host");
  if (host && !host.startsWith("localhost")) {
    const proto = c.req.header("X-Forwarded-Proto") ?? "https";
    return `${proto}://${host}${path}`;
  }
  return `${config.publicBaseUrl.replace(/\/$/, "")}${path}`;
}

export function createTwilioSmsProvider(config: Config): SmsProvider {
  const client = twilio(config.twilioAccountSid!, config.twilioAuthToken!);
  const from = config.twilioPhoneNumber!;

  return {
    async send(to: string, body: string) {
      const message = await client.messages.create({ to, from, body });
      return { sid: message.sid };
    },
  };
}

export function isTwilioOverloadError(error: unknown): boolean {
  if (error instanceof Error && "code" in error) {
    const { code, status } = error as { code?: number; status?: number };
    if (code === 63038 || status === 429) return true;
  }
  return false;
}

export function formatTwilioSendError(error: unknown): string {
  if (isTwilioOverloadError(error)) {
    return "Twilio SMS limit reached. In local dev this should auto-fallback to fake SMS; set CORRESPONDENCE_FAKE_DEMO=1 to skip Twilio entirely.";
  }
  if (error instanceof Error && "code" in error) {
    const code = (error as { code?: number }).code;
    if (code === 30032) {
      return "Twilio trial accounts cannot text unverified numbers. Use Twilio Virtual Phone (+18777804236) or verify the recipient in Twilio Console.";
    }
  }
  return error instanceof Error ? error.message : String(error);
}

export function validateTwilioSignature(
  config: Config,
  signature: string | undefined,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!config.twilioAuthToken || !signature) {
    return false;
  }
  return twilio.validateRequest(config.twilioAuthToken, signature, url, params);
}
