"use client";

import { create } from "zustand";
import {
  initialActivityFeed,
  initialStatusCounts,
  personalEvents as seedPersonalEvents,
  viewings as seedViewings,
  notifications as seedNotifications,
} from "./mockData";
import {
  dedupeWebListings,
  listingDisplayKey,
  sortListingsForFeed,
} from "./liveListings";
import type {
  ActivityEntry,
  Conversation,
  Listing,
  ListingStatus,
  Message,
  PersonalEvent,
  SearchCriteria,
  Viewing,
  BookingNotification,
} from "./types";

const blankCriteria: SearchCriteria = {
  bedrooms: null,
  maxPrice: null,
  neighborhood: null,
  moveInDate: null,
  amenities: [],
  dealBreakers: [],
  readyToSearch: false,
};

interface AppState {
  // criteria
  criteria: SearchCriteria;
  applyCriteriaUpdate: (
    field: keyof Omit<SearchCriteria, "readyToSearch">,
    value: string | number,
  ) => void;
  markReadyToSearch: () => void;
  resetCriteria: () => void;
  updateCriteria: (updates: Partial<SearchCriteria>) => void;

  // listings
  listings: Listing[];
  setListings: (listings: Listing[]) => void;
  /** Merge poll/ingest results; marks new ids fresh and sorts feed. */
  mergeLiveListings: (incoming: Listing[], newIds: string[]) => void;
  freshListingIds: string[];
  freshListingAt: Record<string, number>;
  pruneStaleFreshListings: (maxAgeMs: number) => void;
  prependListing: (l: Listing) => void;
  updateListingStatus: (id: string, status: ListingStatus) => void;

  // conversations
  conversations: Conversation[];
  activeCorrespondenceThreadIds: string[];
  upsertConversation: (c: Conversation) => void;
  trackCorrespondenceThread: (threadId: string) => void;
  appendMessage: (conversationId: string, message: Message) => void;
  setConversationStatus: (
    conversationId: string,
    status: Conversation["status"],
  ) => void;

  // viewings + calendar
  viewings: Viewing[];
  personalEvents: PersonalEvent[];
  addViewing: (v: Viewing) => void;
  notifications: BookingNotification[];
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;

  // dashboard counts (animated tick targets)
  statusCounts: typeof initialStatusCounts;
  setStatusCounts: (counts: typeof initialStatusCounts) => void;
  bumpStatusCount: (
    key: keyof typeof initialStatusCounts,
    by?: number,
  ) => void;

  // activity feed
  activityFeed: ActivityEntry[];
  pushActivity: (entry: ActivityEntry) => void;

  // chat / floating button
  chatOpen: boolean;
  hasChatNotification: boolean;
  setChatOpen: (open: boolean) => void;
  setChatNotification: (on: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // -- criteria --
  criteria: {
    bedrooms: 1,
    maxPrice: 3800,
    neighborhood: "East Village",
    moveInDate: "June 1st, 2026",
    amenities: ["laundry-in-unit", "dishwasher", "pet-friendly", "elevator"],
    dealBreakers: ["no-elevator", "broker-fee"],
    readyToSearch: true,
  },
  applyCriteriaUpdate: (field, value) =>
    set((state) => {
      const next = { ...state.criteria };
      if (field === "amenities" || field === "dealBreakers") {
        const list = next[field] ?? [];
        if (!list.includes(String(value))) {
          next[field] = [...list, String(value)];
        }
      } else if (field === "bedrooms" || field === "maxPrice") {
        next[field] = typeof value === "number" ? value : Number(value);
      } else {
        // neighborhood | moveInDate
        next[field] = String(value);
      }
      return { criteria: next };
    }),
  markReadyToSearch: () =>
    set((state) => ({ criteria: { ...state.criteria, readyToSearch: true } })),
  resetCriteria: () => set({ criteria: { ...blankCriteria } }),
  updateCriteria: (updates) =>
    set((state) => ({ criteria: { ...state.criteria, ...updates } })),

  // -- listings --
  listings: [],
  freshListingIds: [],
  freshListingAt: {},
  setListings: (listings) =>
    set((state) => ({
      listings: sortListingsForFeed(
        dedupeWebListings(listings),
        state.freshListingIds,
      ),
    })),
  mergeLiveListings: (incoming, newIds) =>
    set((state) => {
      const byKey = new Map(state.listings.map((l) => [listingDisplayKey(l), l]));
      for (const row of dedupeWebListings(incoming)) {
        byKey.set(listingDisplayKey(row), row);
      }
      const freshListingAt = { ...state.freshListingAt };
      const freshSet = new Set(state.freshListingIds);
      const now = Date.now();
      for (const id of newIds) {
        freshSet.add(id);
        freshListingAt[id] = now;
      }
      const freshListingIds = [...freshSet];
      const listings = sortListingsForFeed(
        dedupeWebListings([...byKey.values()]),
        freshListingIds,
      );
      return { listings, freshListingIds, freshListingAt };
    }),
  pruneStaleFreshListings: (maxAgeMs) =>
    set((state) => {
      const now = Date.now();
      const freshListingIds = state.freshListingIds.filter(
        (id) => now - (state.freshListingAt[id] ?? 0) < maxAgeMs,
      );
      const freshListingAt = { ...state.freshListingAt };
      for (const id of Object.keys(freshListingAt)) {
        if (!freshListingIds.includes(id)) delete freshListingAt[id];
      }
      return {
        freshListingIds,
        freshListingAt,
        listings: sortListingsForFeed(state.listings, freshListingIds),
      };
    }),
  prependListing: (l) =>
    set((state) => {
      const key = listingDisplayKey(l);
      if (state.listings.some((existing) => listingDisplayKey(existing) === key)) {
        return state;
      }
      return { listings: [l, ...state.listings] };
    }),
  updateListingStatus: (id, status) =>
    set((state) => ({
      listings: state.listings.map((l) =>
        l.id === id ? { ...l, status } : l,
      ),
    })),

  // -- conversations --
  conversations: [],
  activeCorrespondenceThreadIds: [],
  upsertConversation: (c) =>
    set((state) => {
      const idx = state.conversations.findIndex((existing) => existing.id === c.id);
      const nextIds = state.activeCorrespondenceThreadIds.slice();
      if (c.correspondenceThreadId && !nextIds.includes(c.correspondenceThreadId)) {
        nextIds.push(c.correspondenceThreadId);
      }
      if (idx === -1) {
        return {
          conversations: [c, ...state.conversations],
          activeCorrespondenceThreadIds: nextIds,
        };
      }
      const next = state.conversations.slice();
      next[idx] = c;
      return { conversations: next, activeCorrespondenceThreadIds: nextIds };
    }),
  trackCorrespondenceThread: (threadId) =>
    set((state) =>
      state.activeCorrespondenceThreadIds.includes(threadId)
        ? state
        : {
            activeCorrespondenceThreadIds: [
              ...state.activeCorrespondenceThreadIds,
              threadId,
            ],
          },
    ),
  appendMessage: (conversationId, message) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: [...c.messages, message],
              lastUpdated: message.timestamp,
            }
          : c,
      ),
    })),
  setConversationStatus: (conversationId, status) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, status } : c,
      ),
    })),

  // -- viewings + calendar --
  viewings: seedViewings,
  personalEvents: seedPersonalEvents,
  notifications: seedNotifications,
  addViewing: (v) =>
    set((state) => {
      if (state.viewings.some((existing) => existing.id === v.id)) {
        return state;
      }
      const newNotif: BookingNotification = {
        id: `notif-${v.id}-${Date.now()}`,
        viewingId: v.id,
        address: v.address,
        brokerName: v.brokerName,
        startTime: v.startTime,
        timestamp: new Date(),
        read: false,
      };
      return {
        viewings: [...state.viewings, v],
        notifications: [newNotif, ...state.notifications],
      };
    }),
  markNotificationAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),
  clearAllNotifications: () => set({ notifications: [] }),

  // -- status counts --
  statusCounts: { ...initialStatusCounts },
  setStatusCounts: (counts) => set({ statusCounts: counts }),
  bumpStatusCount: (key, by = 1) =>
    set((state) => ({
      statusCounts: {
        ...state.statusCounts,
        [key]: state.statusCounts[key] + by,
      },
    })),

  // -- activity feed --
  activityFeed: initialActivityFeed,
  pushActivity: (entry) =>
    set((state) => ({ activityFeed: [entry, ...state.activityFeed] })),

  // -- chat overlay --
  chatOpen: false,
  hasChatNotification: false,
  setChatOpen: (open) =>
    set((state) =>
      open
        ? { chatOpen: true, hasChatNotification: false }
        : { ...state, chatOpen: false },
    ),
  setChatNotification: (on) => set({ hasChatNotification: on }),
}));
