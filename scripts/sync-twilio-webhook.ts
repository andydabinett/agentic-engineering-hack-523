#!/usr/bin/env npx tsx
/**
 * Point the Twilio number's SMS webhook at the current public URL.
 *
 * Usage:
 *   ngrok http 3001
 *   npm run sync:twilio-webhook
 *
 * Or pass an explicit URL (production or custom tunnel):
 *   npm run sync:twilio-webhook -- --url https://your-app.up.railway.app
 *
 * Dashboard / Next.js (ngrok on :3000):
 *   npm run sync:twilio-webhook -- --next
 */

import "../src/env.ts";

import { loadConfig } from "../src/config.ts";
import {
  HONO_TWILIO_WEBHOOK_PATH,
  NEXT_TWILIO_WEBHOOK_PATH,
  syncTwilioSmsWebhook,
} from "../src/services/sms/sync-webhook.ts";
import { getNgrokPublicUrl } from "../src/tunnel/ngrok.ts";

function readUrlArg(): string | undefined {
  const flagIndex = process.argv.indexOf("--url");
  if (flagIndex >= 0) {
    return process.argv[flagIndex + 1];
  }

  const inline = process.argv.find((arg) => arg.startsWith("--url="));
  return inline?.slice("--url=".length);
}

function readWebhookPath(): string {
  if (process.argv.includes("--next")) {
    return NEXT_TWILIO_WEBHOOK_PATH;
  }

  const flagIndex = process.argv.indexOf("--path");
  if (flagIndex >= 0 && process.argv[flagIndex + 1]) {
    const path = process.argv[flagIndex + 1];
    return path.startsWith("/") ? path : `/${path}`;
  }

  const inline = process.argv.find((arg) => arg.startsWith("--path="));
  if (inline) {
    const path = inline.slice("--path=".length);
    return path.startsWith("/") ? path : `/${path}`;
  }

  return HONO_TWILIO_WEBHOOK_PATH;
}

async function main() {
  const config = loadConfig();
  const explicitUrl = readUrlArg();

  let publicUrl: string;
  if (explicitUrl) {
    publicUrl = explicitUrl.replace(/\/$/, "");
  } else {
    try {
      publicUrl = await getNgrokPublicUrl(undefined, { retries: 20, delayMs: 500 });
    } catch (error) {
      const fallback = config.publicBaseUrl.replace(/\/$/, "");
      if (!fallback.includes("localhost")) {
        publicUrl = fallback;
        console.warn(
          `ngrok not detected; using PUBLIC_BASE_URL=${publicUrl}. Pass --url to override.`,
        );
      } else {
        throw error;
      }
    }
  }

  const webhookPath = readWebhookPath();
  const { webhookUrl, phoneNumberSid } = await syncTwilioSmsWebhook(config, publicUrl, {
    webhookPath,
  });

  console.log(`Twilio SMS webhook updated for ${config.twilioPhoneNumber}`);
  console.log(`  Phone SID: ${phoneNumberSid}`);
  console.log(`  Webhook:   ${webhookUrl}`);
  console.log("");
  console.log("Signature validation uses ngrok forwarded headers; PUBLIC_BASE_URL does not need updating.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
