"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import type { Listing } from "@/lib/types";

/**
 * Generates a Date for the next occurrence of `weekday` at `hour:minute`,
 * skipping today if it would already be in the past.
 */
function upcomingWeekday(weekday: number, hour: number, minute = 0): Date {
  const d = new Date();
  const delta = (weekday + 7 - d.getDay()) % 7;
  const candidate = new Date(d);
  candidate.setDate(d.getDate() + (delta === 0 ? 7 : delta));
  candidate.setHours(hour, minute, 0, 0);
  return candidate;
}

const PHOTOS = [
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1600&q=80",
];

const DEMO_PROFILES = [
  {
    address: "129 St Marks Pl #2F",
    broker: "Naomi Singh",
    phone: "(917) 555-0188",
    price: 3825,
  },
  {
    address: "318 E 4th St #5A",
    broker: "Theo Lindquist",
    phone: "(646) 555-0317",
    price: 3525,
  },
  {
    address: "61 Ave A #3R",
    broker: "Yara Haddad",
    phone: "(917) 555-0421",
    price: 3990,
  },
];

interface SequenceController {
  timers: number[];
  freshListingIds: Set<string>;
}

export function useDemoMode() {
  const ctrl = useRef<SequenceController>({
    timers: [],
    freshListingIds: new Set(),
  });
  const runCount = useRef(0);

  const prependListing = useAppStore((s) => s.prependListing);
  const updateListingStatus = useAppStore((s) => s.updateListingStatus);
  const upsertConversation = useAppStore((s) => s.upsertConversation);
  const appendMessage = useAppStore((s) => s.appendMessage);
  const setConversationStatus = useAppStore((s) => s.setConversationStatus);
  const addViewing = useAppStore((s) => s.addViewing);
  const pushActivity = useAppStore((s) => s.pushActivity);
  const bumpStatusCount = useAppStore((s) => s.bumpStatusCount);
  const setChatNotification = useAppStore((s) => s.setChatNotification);

  const runDemo = useCallback(() => {
    const idx = runCount.current++;
    const profile = DEMO_PROFILES[idx % DEMO_PROFILES.length];
    const stamp = Date.now();
    const id = `listing-demo-${stamp}`;
    const conversationId = `conv-demo-${stamp}`;
    const viewingId = `viewing-demo-${stamp}`;

    const baseListing: Listing = {
      id,
      address: profile.address,
      neighborhood: "East Village",
      pricePerMonth: profile.price,
      beds: 1,
      baths: 1,
      sqftApprox: 655,
      photos: PHOTOS.slice(0, 5),
      brokerName: profile.broker,
      brokerPhone: profile.phone,
      listedAt: new Date(),
      matchScore: 94,
      status: "matched",
      amenities: ["dishwasher", "laundry-in-building", "pet-friendly", "elevator"],
      noBrokerFee: true,
      description:
        "Just-listed 1BR with elevator access and a renovated kitchen. Pet-friendly building with shared laundry.",
    };

    ctrl.current.freshListingIds.add(id);

    // t=0
    prependListing(baseListing);
    bumpStatusCount("listingsMonitored", 1);
    bumpStatusCount("matches", 1);
    pushActivity({
      id: `act-${stamp}-match`,
      icon: "match",
      timestamp: new Date(),
      body: `New match: ${profile.address} · 94 score`,
    });
    toast("New match found", {
      description: `${profile.address} · 94 score`,
    });

    const sched = (ms: number, fn: () => void) => {
      const handle = window.setTimeout(fn, ms);
      ctrl.current.timers.push(handle);
    };

    // t=3000 — broker texted
    sched(3000, () => {
      updateListingStatus(id, "contacted");
      bumpStatusCount("brokersTexted", 1);
      pushActivity({
        id: `act-${stamp}-text`,
        icon: "text",
        timestamp: new Date(),
        body: `Agent texted ${profile.broker} about ${profile.address}`,
      });
    });

    // t=6000 — awaiting reply, new conversation appears
    sched(6000, () => {
      updateListingStatus(id, "awaiting");
      const outbound = {
        id: `msg-${stamp}-1`,
        from: "agent" as const,
        body: `Hi ${profile.broker.split(" ")[0]} — interested in ${profile.address}. Avail Tue 6, Wed 6, or Thu after 6?`,
        timestamp: new Date(),
        receipt: "delivered" as const,
      };
      upsertConversation({
        id: conversationId,
        listingId: id,
        brokerName: profile.broker,
        brokerPhone: profile.phone,
        status: "awaiting",
        lastUpdated: new Date(),
        unread: true,
        messages: [outbound],
      });
      setChatNotification(true);
    });

    // t=10000 — broker replies, viewing scheduled
    sched(10000, () => {
      appendMessage(conversationId, {
        id: `msg-${stamp}-2`,
        from: "broker",
        body: "Wednesday at 6 works. Meet at the lobby buzzer.",
        timestamp: new Date(),
      });
      // Mark outbound as read
      setConversationStatus(conversationId, "scheduled");
      updateListingStatus(id, "scheduled");
      bumpStatusCount("viewingsScheduled", 1);
      pushActivity({
        id: `act-${stamp}-reply`,
        icon: "reply",
        timestamp: new Date(),
        body: `${profile.broker.split(" ")[0]} replied — Wednesday 6pm proposed`,
      });
    });

    // t=12000 — viewing added to calendar + confirm activity
    sched(12000, () => {
      const start = upcomingWeekday(3, 18, 0); // Wed 6:00 pm
      const end = new Date(start.getTime() + 30 * 60_000);
      addViewing({
        id: viewingId,
        listingId: id,
        address: profile.address,
        brokerName: profile.broker,
        startTime: start,
        endTime: end,
      });
      // Append confirmation message from agent
      appendMessage(conversationId, {
        id: `msg-${stamp}-3`,
        from: "agent",
        body: "Confirmed Wed 6pm. Calendar invite sent.",
        timestamp: new Date(),
        receipt: "read",
      });
      pushActivity({
        id: `act-${stamp}-booked`,
        icon: "booked",
        timestamp: new Date(),
        body: `Viewing confirmed for Wed 6pm with ${profile.broker}`,
      });
      toast("Viewing booked", {
        description: `Wed 6pm · ${profile.address}`,
      });
    });
  }, [
    addViewing,
    appendMessage,
    bumpStatusCount,
    prependListing,
    pushActivity,
    setChatNotification,
    setConversationStatus,
    updateListingStatus,
    upsertConversation,
  ]);

  // Keyboard binding: Cmd/Ctrl + Shift + D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCombo =
        (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "d" || e.key === "D");
      if (!isCombo) return;
      e.preventDefault();
      runDemo();
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      // Clear pending timers on unmount so navigating away cancels them.
      for (const t of ctrl.current.timers) window.clearTimeout(t);
      ctrl.current.timers = [];
    };
  }, [runDemo]);

  return { runDemo, freshListingIds: ctrl.current.freshListingIds };
}
