import { loadCorrespondenceBridge } from "@/lib/server/repo";

function parseTwilioForm(body: string, contentType: string | null): Record<string, string> {
  const params: Record<string, string> = {};
  if (contentType?.includes("application/x-www-form-urlencoded")) {
    for (const [key, value] of new URLSearchParams(body)) {
      params[key] = value;
    }
  }
  return params;
}

/** Handle inbound Twilio SMS directly in the Next process (no Hono hop). */
export async function handleTwilioWebhook(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const params = parseTwilioForm(rawBody, request.headers.get("content-type"));
  const { processTwilioSmsWebhook, twilioWebhookUrlForRequest } =
    await loadCorrespondenceBridge();
  const webhookUrl = await twilioWebhookUrlForRequest(request.headers);

  const result = await processTwilioSmsWebhook({
    params,
    signature: request.headers.get("X-Twilio-Signature"),
    webhookUrl,
  });

  return new Response(result.body, {
    status: result.status,
    headers: { "Content-Type": "text/plain" },
  });
}
