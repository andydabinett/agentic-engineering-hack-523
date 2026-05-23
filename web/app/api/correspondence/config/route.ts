import { NextResponse } from "next/server";
import { loadCorrespondenceBridge } from "@/lib/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const { correspondenceFakeDemoEnabled, correspondenceDevEnabled } =
    await loadCorrespondenceBridge();

  return NextResponse.json({
    fakeDemo: correspondenceFakeDemoEnabled(),
    devRoutes: correspondenceDevEnabled(),
  });
}
