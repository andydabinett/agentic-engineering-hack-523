import { NextResponse } from "next/server";
import { requireApiSecret } from "@/lib/server/apiAuth";
import { loadCorrespondenceBridge, loadListingsApi } from "@/lib/server/repo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = requireApiSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const listingId = body.listingId as string | undefined;

    if (!listingId) {
      return NextResponse.json({ error: "listingId is required" }, { status: 400 });
    }

    const { openRepository, getListingById } = await loadListingsApi();
    const {
      startCorrespondence,
      buildListingSummary,
      canStartCorrespondence,
      correspondenceFakeDemoEnabled,
      demoListerPhone,
      useDemoListerPhoneFallback,
    } = await loadCorrespondenceBridge();

    if (!canStartCorrespondence()) {
      return NextResponse.json(
        { error: "Set TWILIO_* or CORRESPONDENCE_FAKE_DEMO=1" },
        { status: 503 },
      );
    }

    const repo = openRepository();
    let listing;
    try {
      listing = getListingById(repo, listingId);
    } finally {
      repo.close();
    }

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const listerPhone =
      body.listerPhone ||
      listing.brokerPhone ||
      (useDemoListerPhoneFallback() ? demoListerPhone() : "");

    if (!listerPhone?.trim()) {
      return NextResponse.json(
        { error: "No broker phone on file for this listing" },
        { status: 400 },
      );
    }

    const view = await startCorrespondence({
      listingId,
      listerPhone,
      listerName: body.listerName || listing.brokerName,
      userId: body.userId,
      listingSummary: body.listingSummary || buildListingSummary(listing),
    });

    return NextResponse.json(
      { ...view, fakeDemo: correspondenceFakeDemoEnabled() },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
