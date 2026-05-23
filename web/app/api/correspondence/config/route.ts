import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    fakeDemo: process.env.CORRESPONDENCE_FAKE_DEMO === "1",
    devRoutes: process.env.CORRESPONDENCE_DEV === "1" || process.env.CORRESPONDENCE_FAKE_DEMO === "1",
  });
}
