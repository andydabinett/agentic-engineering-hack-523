import { NextResponse } from "next/server";
import { loadListingsApi } from "@/lib/server/repo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const borough = searchParams.get("borough") || undefined;
  const source = searchParams.get("source") || undefined;
  const limit = Number(searchParams.get("limit") || 200);
  const since = searchParams.get("since") || undefined;

  try {
    const { openRepository, listListingsAuto, sqliteDbExists } = await loadListingsApi();
    const repo = sqliteDbExists() ? openRepository() : null;
    try {
      const listings = await listListingsAuto(repo, { borough, source, limit, since });
      return NextResponse.json({
        listings,
        serverTime: new Date().toISOString(),
        source: sqliteDbExists() ? "sqlite" : "clickhouse",
      });
    } finally {
      repo?.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, listings: [] }, { status: 500 });
  }
}
