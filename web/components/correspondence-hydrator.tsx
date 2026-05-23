"use client";

import { useEffect } from "react";
import { isDemoMode } from "@/lib/hydrate";
import {
  applyCorrespondenceView,
  fetchCorrespondenceThread,
} from "@/lib/correspondencePoll";
import { isCorrespondenceTerminal } from "@/lib/mapCorrespondence";
import { useAppStore } from "@/lib/store";

const POLL_MS = 2500;

/** Keeps active correspondence threads synced to the Messages UI. */
export function CorrespondenceHydrator() {
  const threadIds = useAppStore((s) => s.activeCorrespondenceThreadIds);
  const listings = useAppStore((s) => s.listings);

  useEffect(() => {
    if (isDemoMode() || threadIds.length === 0) return;

    let cancelled = false;

    const syncAll = async () => {
      for (const threadId of threadIds) {
        if (cancelled) return;
        try {
          const view = await fetchCorrespondenceThread(threadId);
          const listing = listings.find((l) => l.id === view.listingId);
          applyCorrespondenceView(view, listing);

          if (isCorrespondenceTerminal(view.status)) {
            useAppStore.setState((state) => ({
              activeCorrespondenceThreadIds:
                state.activeCorrespondenceThreadIds.filter((id) => id !== threadId),
            }));
          }
        } catch {
          /* correspondence server may be offline */
        }
      }
    };

    void syncAll();
    const handle = window.setInterval(() => void syncAll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [threadIds, listings]);

  return null;
}
