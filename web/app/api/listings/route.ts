import { NextResponse } from "next/server";
import { loadListingsApi, sqliteDatabaseExists } from "@/lib/server/repo";
import { requireNode22 } from "@/lib/server/nodeRuntime";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const nodeError = requireNode22("Listings API");
  if (nodeError) {
    return NextResponse.json({ error: nodeError, listings: [] }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const borough = searchParams.get("borough") || undefined;
  const source = searchParams.get("source") || undefined;
  const limit = Number(searchParams.get("limit") || 200);
  const since = searchParams.get("since") || undefined;

  try {
    const { openRepository, listListingsAuto } = await loadListingsApi();
    const useSqlite = sqliteDatabaseExists();
    const repo = useSqlite ? openRepository() : null;
    try {
      const listings = await listListingsAuto(repo, { borough, source, limit, since });
      return NextResponse.json({
        listings,
        serverTime: new Date().toISOString(),
        source: useSqlite ? "sqlite" : "clickhouse",
      });
    } finally {
      repo?.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, listings: [] }, { status: 500 });
  }
}
