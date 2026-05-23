import { NextResponse } from "next/server";
import { loadListingsApi } from "@/lib/server/repo";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { openRepository, getListingById } = await loadListingsApi();
    const repo = openRepository();
    try {
      const listing = getListingById(repo, params.id);
      if (!listing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ listing });
    } finally {
      repo.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
