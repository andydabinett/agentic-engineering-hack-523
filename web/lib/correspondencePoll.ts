import { toast } from "sonner";
import {
  correspondenceToListingStatus,
  correspondenceToViewing,
  isCorrespondenceTerminal,
  mapCorrespondenceToConversation,
  type CorrespondenceThreadView,
} from "./mapCorrespondence";
import { useAppStore } from "./store";
import type { Listing } from "./types";

export function applyCorrespondenceView(
  view: CorrespondenceThreadView,
  listing?: Listing,
) {
  const store = useAppStore.getState();
  const existing = store.conversations.find(
    (c) => c.correspondenceThreadId === view.threadId,
  );
  const prevInbound =
    existing?.messages.filter((m) => m.from === "broker").length ?? 0;
  const inboundCount = view.messages.filter((m) => m.direction === "inbound").length;

  const conversation = mapCorrespondenceToConversation(view, listing);
  store.upsertConversation(conversation);
  store.updateListingStatus(view.listingId, correspondenceToListingStatus(view.status));

  if (
    !existing &&
    (view.status === "outreach_sent" || view.status === "initiated")
  ) {
    store.pushActivity({
      id: `corr-${view.threadId}-text-${Date.now()}`,
      icon: "text",
      timestamp: new Date(),
      body: `Agent texted ${conversation.brokerName} about ${listing?.address ?? view.listingSummary ?? "a listing"}`,
    });
  }

  const viewing = correspondenceToViewing(view, listing);
  if (
    viewing &&
    (view.status === "viewing_confirmed" ||
      view.status === "calendar_event_created" ||
      view.status === "completed")
  ) {
    const hadViewing = store.viewings.some((v) => v.id === viewing.id);
    if (!hadViewing) {
      store.addViewing(viewing);
      store.bumpStatusCount("viewingsScheduled", 1);
      store.pushActivity({
        id: `corr-${view.threadId}-booked-${Date.now()}`,
        icon: "booked",
        timestamp: new Date(),
        body: `Viewing scheduled — ${viewing.address}`,
      });
    }
  }

  if (inboundCount > prevInbound) {
    store.setChatNotification(true);
    store.pushActivity({
      id: `corr-${view.threadId}-reply-${Date.now()}`,
      icon: "reply",
      timestamp: new Date(),
      body: `${conversation.brokerName.split(" ")[0]} replied`,
    });
  }
}

export async function fetchCorrespondenceThread(
  threadId: string,
): Promise<CorrespondenceThreadView> {
  const res = await fetch(`/api/correspondence/${encodeURIComponent(threadId)}`, {
    cache: "no-store",
  });
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.error || `Correspondence API ${res.status}`);
  }
  return payload as CorrespondenceThreadView;
}

export async function startCorrespondenceForListing(listingId: string) {
  const res = await fetch("/api/correspondence/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listingId }),
  });
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.error || `Start correspondence failed (${res.status})`);
  }
  return payload as CorrespondenceThreadView;
}

export function pollCorrespondenceThread(
  threadId: string,
  listing?: Listing,
  {
    intervalMs = 2500,
    maxAttempts = 120,
    onUpdate,
  }: {
    intervalMs?: number;
    maxAttempts?: number;
    onUpdate?: (view: CorrespondenceThreadView) => void;
  } = {},
) {
  let attempts = 0;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    attempts += 1;
    try {
      const view = await fetchCorrespondenceThread(threadId);
      applyCorrespondenceView(view, listing);
      onUpdate?.(view);

      if (isCorrespondenceTerminal(view.status)) {
        stopped = true;
        if (view.status === "completed") {
          toast.success("Viewing coordination complete", {
            description: listing?.address ?? view.listingSummary ?? undefined,
          });
        } else if (view.status === "failed") {
          toast.error("Correspondence failed", {
            description: view.errorMessage ?? undefined,
          });
        }
        return;
      }
    } catch {
      /* retry */
    }

    if (attempts >= maxAttempts) {
      stopped = true;
      toast.message("Still coordinating with broker", {
        description: "Check Messages for the latest updates.",
      });
      return;
    }

    setTimeout(tick, intervalMs);
  };

  void tick();

  return () => {
    stopped = true;
  };
}

export function handleCorrespondenceStarted(
  data: {
    ok?: boolean;
    threadId?: string;
    listingId?: string;
    address?: string;
    brokerName?: string;
    messages?: CorrespondenceThreadView["messages"];
    status?: string;
  },
  listing?: Listing,
) {
  if (!data.ok || !data.threadId || !data.listingId) return;

  const view: CorrespondenceThreadView = {
    threadId: data.threadId,
    listingId: data.listingId,
    listerPhone: listing?.brokerPhone ?? "",
    listerName: data.listerName ?? data.brokerName ?? listing?.brokerName,
    userId: "web-user",
    status: data.status ?? "awaiting_lister_reply",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: data.messages ?? [],
  };

  applyCorrespondenceView(view, listing);
  useAppStore.getState().trackCorrespondenceThread(data.threadId);
  useAppStore.getState().bumpStatusCount("brokersTexted", 1);
  useAppStore.getState().setChatNotification(true);

  toast.message("Texting broker", {
    description: data.address ?? listing?.address,
  });

  pollCorrespondenceThread(data.threadId, listing);
}
