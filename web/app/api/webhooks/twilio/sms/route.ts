import { handleTwilioWebhook } from "@/lib/server/correspondenceProxy";

export const runtime = "nodejs";

/** Public Twilio webhook — handled in-process by the correspondence orchestrator. */
export async function POST(request: Request) {
  try {
    return await handleTwilioWebhook(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(message, { status: 502 });
  }
}
