"use client";

import { useEffect } from "react";
import { isDemoMode } from "@/lib/hydrate";
import {
  applyCorrespondenceView,
  fetchCorrespondenceThread,
} from "@/lib/correspondencePoll";
import { isCorrespondenceTerminal, type CorrespondenceThreadView } from "@/lib/mapCorrespondence";
import { useAppStore } from "@/lib/store";

const POLL_MS = 2500;

/** Keeps active correspondence threads synced to the Messages UI. */
export function CorrespondenceHydrator() {
  const threadIds = useAppStore((s) => s.activeCorrespondenceThreadIds);
  const listings = useAppStore((s) => s.listings);

  // Bootstrap all threads from the database on mount
  useEffect(() => {
    if (isDemoMode()) return;

    let cancelled = false;

    const bootstrap = async () => {
      try {
        const res = await fetch("/api/correspondence", { cache: "no-store" });
        if (!res.ok) throw new Error(`Correspondence API ${res.status}`);
        const threads = (await res.json()) as CorrespondenceThreadView[];
        if (cancelled) return;

        const activeIds: string[] = [];
        
        for (const view of threads) {
          const listing = useAppStore.getState().listings.find((l) => l.id === view.listingId);
          applyCorrespondenceView(view, listing);
          
          if (!isCorrespondenceTerminal(view.status)) {
            activeIds.push(view.threadId);
          }
        }

        if (activeIds.length > 0) {
          useAppStore.setState((state) => {
            const combined = Array.from(
              new Set([...state.activeCorrespondenceThreadIds, ...activeIds])
            );
            return { activeCorrespondenceThreadIds: combined };
          });
        }
      } catch (err) {
        console.warn("Correspondence bootstrap failed", err);
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

