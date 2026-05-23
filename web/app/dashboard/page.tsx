"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { listingMatchesCriteria } from "@/lib/matchesCriteria";
import { useAppStore } from "@/lib/store";
import { DashboardStatusBar } from "@/components/dashboard-status-bar";
import { ActivityFeed } from "@/components/activity-feed";
import { ListingCard } from "@/components/listing-card";
import { useDemoMode } from "@/components/use-demo-mode";
import { startCorrespondenceForListing, handleCorrespondenceStarted } from "@/lib/correspondencePoll";
import { toast } from "sonner";

export default function DashboardPage() {
  const listings = useAppStore((s) => s.listings);
  const criteria = useAppStore((s) => s.criteria);
  const liveFreshIds = useAppStore((s) => s.freshListingIds);
  const { runDemo, freshListingIds: demoFreshIds } = useDemoMode();
  const [triggering, setTriggering] = useState(false);

  const visibleListings = useMemo(
    () => listings.filter((l) => listingMatchesCriteria(l, criteria)),
    [listings, criteria],
  );

  const freshSet = useMemo(() => {
    const s = new Set(liveFreshIds);
    demoFreshIds.forEach((id) => s.add(id));
    return s;
  }, [liveFreshIds, demoFreshIds]);

  const triggerLatestOutreach = async () => {
    const latestListing = visibleListings[0];
    if (!latestListing) {
      toast.error("No matching listings found to text");
      return;
    }
    setTriggering(true);
    try {
      const view = await startCorrespondenceForListing(latestListing.id);
      handleCorrespondenceStarted(
        {
          ok: true,
          fakeDemo: view.fakeDemo,
          threadId: view.threadId,
          listingId: view.listingId,
          status: view.status,
          brokerName: latestListing.brokerName,
          address: latestListing.address,
          messages: view.messages,
        },
        latestListing,
      );
    } catch (err) {
      toast.error("Could not start outreach", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardStatusBar />

      <div className="flex flex-1 gap-6 px-8 pt-6 pb-10">
        {/* Listings grid */}
        <section className="min-w-0 flex-1">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                Matches
              </p>
              <h1 className="mt-1 font-serif text-3xl leading-tight tracking-tight">
                Today&apos;s feed
              </h1>
              <p className="mt-1 text-[13.5px] text-ink-muted">
                Live updates every ~{Math.round(Number(process.env.NEXT_PUBLIC_LISTINGS_POLL_MS || 20000) / 1000)}s
                when the crawler finds new matches.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={visibleListings.length === 0 || triggering}
                onClick={triggerLatestOutreach}
                className="inline-flex items-center gap-1.5 rounded-md border border-rule px-2.5 py-1.5 text-[11.5px] text-ink-muted hover:border-rule-strong hover:bg-surface-raised hover:text-ink disabled:opacity-50"
              >
                <span>{triggering ? "Texting..." : "Text Latest Listing"}</span>
              </button>

              <button
                type="button"
                onClick={runDemo}
                className="inline-flex items-center gap-1.5 rounded-md border border-rule px-2.5 py-1.5 text-[11.5px] text-ink-muted hover:border-rule-strong hover:bg-surface-raised hover:text-ink"
                aria-label="Run demo sequence"
                title="Run demo sequence (⌘⇧D)"
              >
                <Sparkles className="h-3 w-3" />
                <span className="font-mono">⌘⇧D</span>
                <span>demo</span>
              </button>
            </div>
          </div>

          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visibleListings.map((l, i) => (
              <ListingCard
                key={l.id}
                listing={l}
                index={i}
                fresh={freshSet.has(l.id)}
              />
            ))}
          </ul>
          {visibleListings.length === 0 && (
            <p className="rounded-xl border border-dashed border-rule bg-surface px-6 py-12 text-center text-[14px] text-ink-muted">
              No listings yet — set criteria in chat and start a scrape, or wait for the
              background crawler.
            </p>
          )}
        </section>

        {/* Activity sidebar */}
        <ActivityFeed />
      </div>
    </div>
  );
}
