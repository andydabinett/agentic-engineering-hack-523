import twilio from "twilio";

import type { Config } from "../../config.ts";

/** Hono correspondence server (legacy dev:correspondence on :3001). */
export const HONO_TWILIO_WEBHOOK_PATH = "/webhooks/twilio/sms";

/** Next.js public webhook (dashboard + in-process orchestrator). */
export const NEXT_TWILIO_WEBHOOK_PATH = "/api/webhooks/twilio/sms";

export function resolveTwilioWebhookPath(): string {
  const fromEnv = process.env.TWILIO_WEBHOOK_PATH?.trim();
  if (fromEnv) return fromEnv.startsWith("/") ? fromEnv : `/${fromEnv}`;
  return HONO_TWILIO_WEBHOOK_PATH;
}

export function twilioSmsWebhookUrl(
  publicBaseUrl: string,
  webhookPath: string = resolveTwilioWebhookPath(),
): string {
  const path = webhookPath.startsWith("/") ? webhookPath : `/${webhookPath}`;
  return `${publicBaseUrl.replace(/\/$/, "")}${path}`;
}

export async function syncTwilioSmsWebhook(
  config: Config,
  publicBaseUrl: string,
  options?: { webhookPath?: string },
): Promise<{ webhookUrl: string; phoneNumberSid: string }> {
  if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioPhoneNumber) {
    throw new Error(
      "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are required",
    );
  }

  const client = twilio(config.twilioAccountSid, config.twilioAuthToken);
  const webhookUrl = twilioSmsWebhookUrl(publicBaseUrl, options?.webhookPath);

  const phoneNumberSid =
    process.env.TWILIO_PHONE_NUMBER_SID ??
    (await findIncomingPhoneNumberSid(client, config.twilioPhoneNumber));

  await client.incomingPhoneNumbers(phoneNumberSid).update({
    smsUrl: webhookUrl,
    smsMethod: "POST",
  });

  return { webhookUrl, phoneNumberSid };
}

async function findIncomingPhoneNumberSid(
  client: ReturnType<typeof twilio>,
  phoneNumber: string,
): Promise<string> {
  const numbers = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
  const match = numbers[0];
  if (!match?.sid) {
    throw new Error(
      `No Twilio incoming phone number found for ${phoneNumber}. Check TWILIO_PHONE_NUMBER or set TWILIO_PHONE_NUMBER_SID.`,
    );
  }
  return match.sid;
}
