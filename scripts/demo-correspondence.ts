#!/usr/bin/env npx tsx
/**
 * Demo script for live correspondence with a verified Twilio trial phone.
 *
 * Usage:
 *   npm run dev:correspondence
 *   npm run demo:correspondence -- +18777804236
 *
 * Without ngrok, simulate lister replies:
 *   curl -X POST http://localhost:3001/correspondence/<threadId>/simulate-reply \
 *     -H 'Content-Type: application/json' -d '{"body":"Saturday works"}'
 *   (requires CORRESPONDENCE_DEV=1)
 */

import "../src/env.ts";

const port = process.env.PORT ?? "3001";
const baseUrl = process.env.PUBLIC_BASE_URL?.includes("localhost")
  ? `http://localhost:${port}`
  : (process.env.PUBLIC_BASE_URL ?? `http://localhost:${port}`);
const listerPhone = process.argv[2];

if (!listerPhone) {
  console.error("Usage: npm run demo:correspondence -- <verified-lister-phone-e164>");
  process.exit(1);
}

async function main() {
  console.log(`Starting correspondence demo against ${baseUrl}`);
  console.log(`Lister phone (must be Twilio-verified on trial): ${listerPhone}`);

  const startResponse = await fetch(`${baseUrl}/correspondence/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listingId: "demo-listing-1",
      listerPhone,
      listerName: "Demo Lister",
      userId: "demo-user",
      listingSummary: "1BR in Brooklyn, $2400/month",
    }),
  });

  if (!startResponse.ok) {
    console.error("Start failed:", await startResponse.text());
    process.exit(1);
  }

  const started = await startResponse.json();
  console.log("Thread created:", started.threadId);
  console.log("Status:", started.status);
  console.log("First SMS:", started.messages[0]?.body);

  console.log("\nReply from the lister phone to continue the conversation.");
  console.log("Poll thread status with:");
  console.log(`  curl ${baseUrl}/correspondence/${started.threadId}`);

  for (let i = 0; i < 12; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const poll = await fetch(`${baseUrl}/correspondence/${started.threadId}`);
    const view = await poll.json();
    console.log(`[poll] status=${view.status} messages=${view.messages.length}`);
    if (view.status === "completed" || view.status === "failed") {
      console.log(JSON.stringify(view, null, 2));
      break;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
