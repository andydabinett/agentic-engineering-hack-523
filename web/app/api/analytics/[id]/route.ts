import { NextResponse } from "next/server";
import { loadClickHouseAnalytics, loadListingsApi } from "@/lib/server/repo";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { parseDbId } = await loadListingsApi();
  const listingId = parseDbId(params.id);
  if (!listingId) {
    return NextResponse.json({ error: "Invalid listing id" }, { status: 400 });
  }

  try {
    const { getListingAnalytics } = await loadClickHouseAnalytics();
    const analytics = await getListingAnalytics(listingId);
    if (!analytics) {
      return NextResponse.json({ analytics: null, source: "clickhouse" });
    }
    return NextResponse.json({ analytics, source: "clickhouse" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ analytics: null, error: message }, { status: 200 });
  }
}
