#!/usr/bin/env npx tsx
/**
 * Hands-free fake demo: start thread + scripted broker replies (no Twilio inbound).
 *
 * Usage:
 *   CORRESPONDENCE_FAKE_DEMO=1 CORRESPONDENCE_DEV=1 npm run server
 *   npm run demo:fake-correspondence -- db-1
 */

import "../src/env.ts";

import {
  demoListerPhone,
  simulateCorrespondenceReply,
  startCorrespondence,
} from "../src/bridge/correspondenceClient.js";

const port = process.env.PORT ?? "3001";
const baseUrl = `http://localhost:${port}`;
const listingId = process.argv[2] ?? "demo-listing-1";

const FAKE_REPLIES = [
  "Hi Javier — yes, the unit is still available. I could do Saturday afternoon for a showing.",
  "Saturday at 2pm works great. Meet at the lobby buzzer 2R.",
];

async function main() {
  if (process.env.CORRESPONDENCE_FAKE_DEMO !== "1") {
    console.error("Set CORRESPONDENCE_FAKE_DEMO=1 (and CORRESPONDENCE_DEV=1) in .env");
    process.exit(1);
  }

  console.log(`Fake demo against ${baseUrl}`);
  console.log(`Listing: ${listingId} · Lister: ${demoListerPhone()}`);

  const started = await startCorrespondence({
    listingId,
    listerPhone: demoListerPhone(),
    listerName: "Demo Broker",
    userId: "demo-user",
    listingSummary: "Demo unit for UI walkthrough",
  });

  console.log("Thread:", started.threadId);
  console.log("Javier:", started.messages[0]?.body);

  for (const reply of FAKE_REPLIES) {
    await new Promise((r) => setTimeout(r, 3500));
    const view = await simulateCorrespondenceReply(started.threadId, reply);
    const last = view.messages[view.messages.length - 1];
    console.log(`\nBroker: ${reply}`);
    if (last?.direction === "outbound") {
      console.log(`Javier: ${last.body}`);
    }
    console.log(`Status: ${view.status}`);

    if (view.status === "completed" || view.status === "failed") {
      break;
    }
  }

  const final = await fetch(`${baseUrl}/correspondence/${started.threadId}`).then((r) =>
    r.json(),
  );
  console.log("\nFinal:", JSON.stringify(final, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
