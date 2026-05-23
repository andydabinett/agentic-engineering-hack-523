const DEFAULT_CORRESPONDENCE_URL = "http://127.0.0.1:3001";

export function correspondenceBaseUrl(): string {
  return (process.env.CORRESPONDENCE_API_URL || DEFAULT_CORRESPONDENCE_URL).replace(
    /\/$/,
    "",
  );
}

/** Forward inbound Twilio webhook to the Hono correspondence server. */
export async function proxyTwilioWebhook(request: Request): Promise<Response> {
  const body = await request.text();
  const headers = new Headers();

  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const signature = request.headers.get("X-Twilio-Signature");
  if (signature) headers.set("X-Twilio-Signature", signature);

  const host = request.headers.get("host");
  if (host) {
    headers.set("X-Forwarded-Host", host);
    headers.set("X-Forwarded-Proto", request.headers.get("x-forwarded-proto") ?? "https");
  }

  const upstream = await fetch(`${correspondenceBaseUrl()}/webhooks/twilio/sms`, {
    method: "POST",
    headers,
    body,
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "text/plain",
    },
  });
}
