"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { fetchListingsFromApi, fetchPipelineStats, isDemoMode } from "@/lib/hydrate";
import { listings as mockListings, initialStatusCounts } from "@/lib/mockData";
import { useAppStore } from "@/lib/store";

/** Loads SQLite listings + pipeline stats into Zustand (skips when ?demo=1). */
export function ListingsHydrator() {
  const pathname = usePathname();
  const setListings = useAppStore((s) => s.setListings);
  const setStatusCounts = useAppStore((s) => s.setStatusCounts);
  const conversations = useAppStore((s) => s.conversations);
  const viewings = useAppStore((s) => s.viewings);

  useEffect(() => {
    if (isDemoMode()) {
      setListings(mockListings);
      setStatusCounts(initialStatusCounts);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const [listings, stats] = await Promise.all([
          fetchListingsFromApi(),
          fetchPipelineStats(),
        ]);
        if (cancelled) return;

        if (listings.length) {
          setListings(listings);
        }

        if (stats) {
          setStatusCounts({
            listingsMonitored: stats.listingsMonitored,
            matches: stats.matches,
            brokersTexted: conversations.length || stats.brokersTexted,
            viewingsScheduled: viewings.length || stats.viewingsScheduled,
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("Pipeline hydrate failed", err);
          toast.error("Could not load live listings — is the API running?");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, setListings, setStatusCounts, conversations.length, viewings.length]);

  return null;
}
