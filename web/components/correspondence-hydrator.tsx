"use client";

import { useEffect, useRef } from "react";
import { isDemoMode } from "@/lib/hydrate";
import {
  applyCorrespondenceView,
  fetchCorrespondenceThread,
} from "@/lib/correspondencePoll";
import { isCorrespondenceTerminal } from "@/lib/mapCorrespondence";
import type { CorrespondenceThreadView } from "@/lib/mapCorrespondence";
import { useAppStore } from "@/lib/store";

const POLL_MS = 2500;

async function fetchCorrespondenceThreads(): Promise<CorrespondenceThreadView[]> {
  const res = await fetch("/api/correspondence?userId=web-user", { cache: "no-store" });
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.error || `Correspondence list ${res.status}`);
  }
  return payload as CorrespondenceThreadView[];
}

/** Keeps active correspondence threads synced to the Messages UI. */
export function CorrespondenceHydrator() {
  const threadIds = useAppStore((s) => s.activeCorrespondenceThreadIds);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (isDemoMode() || bootstrappedRef.current) return;

    let cancelled = false;
    bootstrappedRef.current = true;

    const bootstrap = async () => {
      try {
        const threads = await fetchCorrespondenceThreads();
        if (cancelled) return;
        const listings = useAppStore.getState().listings;
        for (const view of threads) {
          const listing = listings.find((l) => l.id === view.listingId);
          applyCorrespondenceView(view, listing);
        }
      } catch {
        /* correspondence may be offline */
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isDemoMode() || threadIds.length === 0) return;

    let cancelled = false;

    const syncAll = async () => {
      for (const threadId of threadIds) {
        if (cancelled) return;
        try {
          const view = await fetchCorrespondenceThread(threadId);
          const listing = useAppStore
            .getState()
            .listings.find((l) => l.id === view.listingId);
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
  }, [threadIds]);

  return null;
}
