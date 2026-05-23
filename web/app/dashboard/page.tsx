"use client";

import { Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { DashboardStatusBar } from "@/components/dashboard-status-bar";
import { ActivityFeed } from "@/components/activity-feed";
import { ListingCard } from "@/components/listing-card";
import { useDemoMode } from "@/components/use-demo-mode";

export default function DashboardPage() {
  const listings = useAppStore((s) => s.listings);
  const { runDemo, freshListingIds } = useDemoMode();

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
                Sorted by recency. Click any card to open the deal sheet.
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
            {listings.map((l, i) => (
              <ListingCard
                key={l.id}
                listing={l}
                index={i}
                fresh={freshListingIds.has(l.id)}
              />
            ))}
          </ul>
        </section>

        {/* Activity sidebar */}
        <ActivityFeed />
      </div>
    </div>
  );
}
