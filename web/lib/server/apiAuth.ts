import { NextResponse } from "next/server";

/** Optional bearer / x-api-key guard when API_SECRET is set. */
export function requireApiSecret(request: Request): NextResponse | null {
  const secret = process.env.API_SECRET?.trim();
  if (!secret) return null;

  const authorization = request.headers.get("authorization");
  const apiKey = request.headers.get("x-api-key");

  if (authorization === `Bearer ${secret}` || apiKey === secret) {
    return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
