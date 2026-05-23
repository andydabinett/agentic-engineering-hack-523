"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  fetchListingsFromApi,
  fetchPipelineStats,
  isDemoMode,
} from "@/lib/hydrate";
import {
  FRESH_HIGHLIGHT_MS,
  LISTINGS_POLL_MS,
  mergeListingSnapshots,
} from "@/lib/liveListings";
import { listingMatchesCriteria } from "@/lib/matchesCriteria";
import { listings as mockListings, initialStatusCounts } from "@/lib/mockData";
import { useAppStore } from "@/lib/store";
import type { Listing } from "@/lib/types";

function notifyNewListings(newListings: Listing[]) {
  const store = useAppStore.getState();
  const criteria = store.criteria;
  const matching = newListings.filter((l) => listingMatchesCriteria(l, criteria));

  if (!matching.length) return;

  for (const listing of matching) {
    store.pushActivity({
      id: `live-${listing.id}-${Date.now()}`,
      icon: "match",
      timestamp: new Date(),
      body: `New ${listing.source ?? "listing"} match — ${listing.address} at $${listing.pricePerMonth.toLocaleString()}/mo`,
    });
  }

  store.bumpStatusCount("listingsMonitored", matching.length);
  store.bumpStatusCount("matches", matching.length);
  store.setChatNotification(true);

  const label =
    matching.length === 1
      ? matching[0].address
      : `${matching.length} new listings`;
  toast.success("New listing on the feed", {
    description: label,
  });
}

/** Loads listings, polls for crawler/agent updates, highlights fresh matches. */
export function ListingsHydrator() {
  const pathname = usePathname();
  const setListings = useAppStore((s) => s.setListings);
  const mergeLiveListings = useAppStore((s) => s.mergeLiveListings);
  const pruneStaleFreshListings = useAppStore((s) => s.pruneStaleFreshListings);
  const setStatusCounts = useAppStore((s) => s.setStatusCounts);
  const conversations = useAppStore((s) => s.conversations);
  const viewings = useAppStore((s) => s.viewings);

  const lastSyncAt = useRef<string | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (isDemoMode()) {
      setListings(mockListings);
      setStatusCounts(initialStatusCounts);
      return;
    }

    let cancelled = false;
    lastSyncAt.current = null;
    initialLoadDone.current = false;

    const applyStats = async () => {
      const stats = await fetchPipelineStats();
      if (cancelled || !stats) return;
      setStatusCounts({
        listingsMonitored: stats.listingsMonitored,
        matches: stats.matches,
        brokersTexted: conversations.length || stats.brokersTexted,
        viewingsScheduled: viewings.length || stats.viewingsScheduled,
      });
    };

    const syncListings = async (mode: "full" | "delta") => {
      const since = mode === "delta" ? lastSyncAt.current ?? undefined : undefined;
      const { listings: incoming, serverTime } = await fetchListingsFromApi(
        since ? { since } : undefined,
      );
      if (cancelled) return;

      lastSyncAt.current = serverTime;

      const prev = useAppStore.getState().listings;

      if (!initialLoadDone.current || mode === "full") {
        initialLoadDone.current = true;
        if (incoming.length) {
          setListings(incoming);
        }
        return;
      }

      if (!incoming.length) return;

      const { merged, newIds } = mergeListingSnapshots(prev, incoming);
      const newListings = merged.filter((l) => newIds.includes(l.id));
      mergeLiveListings(merged, newIds);
      notifyNewListings(newListings);
    };

    const bootstrap = async () => {
      try {
        await syncListings("full");
        await applyStats();
      } catch (err) {
        if (!cancelled) {
          console.warn("Pipeline hydrate failed", err);
          toast.error("Could not load live listings — is the API running?");
        }
      }
    };

    bootstrap();

    const pollId = window.setInterval(async () => {
      try {
        await syncListings("delta");
        await applyStats();
      } catch (err) {
        console.warn("Listings poll failed", err);
      }
    }, LISTINGS_POLL_MS);

    const pruneId = window.setInterval(() => {
      pruneStaleFreshListings(FRESH_HIGHLIGHT_MS);
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      window.clearInterval(pruneId);
    };
  }, [
    pathname,
    setListings,
    mergeLiveListings,
    pruneStaleFreshListings,
    setStatusCounts,
    conversations.length,
    viewings.length,
  ]);

  return null;
}
