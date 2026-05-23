"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { listingMatchesCriteria } from "@/lib/matchesCriteria";
import { useAppStore } from "@/lib/store";
import { DashboardStatusBar } from "@/components/dashboard-status-bar";
import { ActivityFeed } from "@/components/activity-feed";
import { ListingCard } from "@/components/listing-card";
import { useDemoMode } from "@/components/use-demo-mode";

export default function DashboardPage() {
  const listings = useAppStore((s) => s.listings);
  const criteria = useAppStore((s) => s.criteria);
  const liveFreshIds = useAppStore((s) => s.freshListingIds);
  const { runDemo, freshListingIds: demoFreshIds } = useDemoMode();
  const [showAllListings, setShowAllListings] = useState(false);

  const matchedListings = useMemo(
    () => listings.filter((l) => listingMatchesCriteria(l, criteria)),
    [listings, criteria],
  );

  const visibleListings =
    showAllListings || !criteria.readyToSearch
      ? listings
      : matchedListings.length > 0
        ? matchedListings
        : listings;

  const filteredOutCount =
    criteria.readyToSearch && !showAllListings
      ? listings.length - matchedListings.length
      : 0;

  const freshSet = useMemo(() => {
    const s = new Set(liveFreshIds);
    demoFreshIds.forEach((id) => s.add(id));
    return s;
  }, [liveFreshIds, demoFreshIds]);

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
            <div className="rounded-xl border border-dashed border-rule bg-surface px-6 py-12 text-center">
              <p className="text-[14px] text-ink-muted">
                {listings.length === 0
                  ? "No listings yet — set criteria in chat and run Scan listings now on My Criteria, or wait for the background crawler."
                  : `No listings match your criteria${criteria.neighborhood ? ` (${criteria.neighborhood}` : ""}${criteria.maxPrice ? `, ≤$${criteria.maxPrice.toLocaleString()}` : ""}${criteria.bedrooms != null ? `, ${criteria.bedrooms === 0 ? "studio" : `${criteria.bedrooms}BR`}` : ""}${criteria.neighborhood || criteria.maxPrice || criteria.bedrooms != null ? ")" : ""}.`}
              </p>
              {listings.length > 0 && criteria.readyToSearch && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAllListings(true)}
                    className="text-[13px] font-medium text-accent hover:underline"
                  >
                    Show all {listings.length} listings
                  </button>
                  <span className="text-ink-faint">·</span>
                  <Link href="/criteria" className="text-[13px] text-ink-muted hover:text-ink">
                    Broaden criteria
                  </Link>
                </div>
              )}
            </div>
          )}
          {filteredOutCount > 0 && visibleListings.length > 0 && (
            <p className="mt-4 text-center text-[12px] text-ink-faint">
              Showing {visibleListings.length} of {listings.length} listings
              {showAllListings ? " (all)" : " that match your criteria"}.
              {!showAllListings && (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={() => setShowAllListings(true)}
                    className="text-accent hover:underline"
                  >
                    Show all
                  </button>
                </>
              )}
            </p>
          )}
        </section>

        {/* Activity sidebar */}
        <ActivityFeed />
      </div>
    </div>
  );
}
