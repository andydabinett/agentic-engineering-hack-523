import { NextResponse } from "next/server";
import { loadCorrespondenceBridge } from "@/lib/server/repo";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { threadId: string } },
) {
  try {
    const { getCorrespondenceThread } = await loadCorrespondenceBridge();
    const view = await getCorrespondenceThread(params.threadId);
    return NextResponse.json(view);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
