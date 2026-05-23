import { NextResponse } from "next/server";
import { loadAgentScrape } from "@/lib/server/repo";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { getAgentScrapeStatus } = await loadAgentScrape();
    return NextResponse.json(getAgentScrapeStatus());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, running: false }, { status: 500 });
  }
}
