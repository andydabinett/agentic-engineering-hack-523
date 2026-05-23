import { NextResponse } from "next/server";
import { loadListingsApi } from "@/lib/server/repo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const borough = searchParams.get("borough") || undefined;
  const source = searchParams.get("source") || undefined;
  const limit = Number(searchParams.get("limit") || 200);

  try {
    const { openRepository, listListings } = await loadListingsApi();
    const repo = openRepository();
    try {
      const listings = listListings(repo, { borough, source, limit });
      return NextResponse.json({ listings, source: "sqlite" });
    } finally {
      repo.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, listings: [] }, { status: 500 });
  }
}
