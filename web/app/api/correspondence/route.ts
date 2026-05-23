import { NextResponse } from "next/server";
import { loadCorrespondenceBridge } from "@/lib/server/repo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId") ?? undefined;
    const userId = searchParams.get("userId") ?? undefined;
    const { listCorrespondenceThreads } = await loadCorrespondenceBridge();
    const threads = await listCorrespondenceThreads({ listingId, userId });
    return NextResponse.json(threads);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
