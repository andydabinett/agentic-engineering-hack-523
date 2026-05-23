"use client";

import { useEffect, useRef } from "react";
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
import {
  listings as mockListings,
  initialStatusCounts,
  conversations as seedConversations,
  viewings as seedViewings,
  notifications as seedNotifications,
  personalEvents as seedPersonalEvents,
  initialActivityFeed,
} from "@/lib/mockData";
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
  const setListings = useAppStore((s) => s.setListings);
  const mergeLiveListings = useAppStore((s) => s.mergeLiveListings);
  const pruneStaleFreshListings = useAppStore((s) => s.pruneStaleFreshListings);
  const setStatusCounts = useAppStore((s) => s.setStatusCounts);

  const lastSyncAt = useRef<string | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (isDemoMode()) {
      setListings(mockListings);
      setStatusCounts(initialStatusCounts);
      useAppStore.setState({
        conversations: seedConversations,
        viewings: seedViewings,
        notifications: seedNotifications,
        personalEvents: seedPersonalEvents,
        activityFeed: initialActivityFeed,
      });
      return;
    }

    let cancelled = false;
    lastSyncAt.current = null;
    initialLoadDone.current = false;

    const applyStats = async () => {
      const stats = await fetchPipelineStats();
      if (cancelled || !stats) return;
      const state = useAppStore.getState();
      setStatusCounts({
        listingsMonitored: stats.listingsMonitored,
        matches: stats.matches,
        brokersTexted: state.conversations.length || stats.brokersTexted,
        viewingsScheduled: state.viewings.length || stats.viewingsScheduled,
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
        // Don't wipe a good feed if a refetch returns empty (e.g. transient API error).
        if (incoming.length > 0 || prev.length === 0) {
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
          const message =
            err instanceof Error ? err.message : "Could not load live listings";
          toast.error(message, {
            description:
              message.includes("Node.js 22")
                ? undefined
                : "Check the terminal where npm run web:dev is running.",
          });
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
    setListings,
    mergeLiveListings,
    pruneStaleFreshListings,
    setStatusCounts,
  ]);

  return null;
}
