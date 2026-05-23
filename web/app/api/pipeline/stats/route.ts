import { NextResponse } from "next/server";
import { loadListingsApi } from "@/lib/server/repo";
import { requireNode22 } from "@/lib/server/nodeRuntime";

export const runtime = "nodejs";

export async function GET() {
  const nodeError = requireNode22("Pipeline stats");
  if (nodeError) {
    return NextResponse.json({ error: nodeError }, { status: 503 });
  }

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
