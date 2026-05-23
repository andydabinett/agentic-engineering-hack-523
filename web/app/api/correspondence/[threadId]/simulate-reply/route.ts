import { NextResponse } from "next/server";
import { loadCorrespondenceBridge } from "@/lib/server/repo";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { threadId: string } },
) {
  if (
    process.env.CORRESPONDENCE_DEV !== "1" &&
    process.env.CORRESPONDENCE_FAKE_DEMO !== "1"
  ) {
    return NextResponse.json({ error: "Dev routes disabled" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { simulateCorrespondenceReply } = await loadCorrespondenceBridge();
    const view = await simulateCorrespondenceReply(params.threadId, body.body ?? "");
    return NextResponse.json(view);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
