import { NextResponse } from "next/server";
import { loadListingsApi } from "@/lib/server/repo";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { openRepository, getPipelineStats } = await loadListingsApi();
    const repo = openRepository();
    try {
      const stats = getPipelineStats(repo);
      return NextResponse.json({ stats, source: "sqlite" });
    } finally {
      repo.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
