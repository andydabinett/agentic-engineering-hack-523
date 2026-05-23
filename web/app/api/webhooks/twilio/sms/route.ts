import { proxyTwilioWebhook } from "@/lib/server/correspondenceProxy";

export const runtime = "nodejs";

/** Public Twilio webhook — proxied to internal Hono on CORRESPONDENCE_API_URL. */
export async function POST(request: Request) {
  try {
    return await proxyTwilioWebhook(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(message, { status: 502 });
  }
}
