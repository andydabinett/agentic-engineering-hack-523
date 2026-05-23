"use client";

import { create } from "zustand";
import {
  conversations as seedConversations,
  initialActivityFeed,
  initialStatusCounts,
  personalEvents as seedPersonalEvents,
  viewings as seedViewings,
  notifications as seedNotifications,
} from "./mockData";
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

  // listings
  listings: Listing[];
  setListings: (listings: Listing[]) => void;
  prependListing: (l: Listing) => void;
  updateListingStatus: (id: string, status: ListingStatus) => void;

  // conversations
  conversations: Conversation[];
  upsertConversation: (c: Conversation) => void;
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
  criteria: { ...blankCriteria },
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

  // -- listings --
  listings: [],
  setListings: (listings) => set({ listings }),
  prependListing: (l) =>
    set((state) =>
      state.listings.some((existing) => existing.id === l.id)
        ? state
        : { listings: [l, ...state.listings] },
    ),
  updateListingStatus: (id, status) =>
    set((state) => ({
      listings: state.listings.map((l) =>
        l.id === id ? { ...l, status } : l,
      ),
    })),

  // -- conversations --
  conversations: seedConversations,
  upsertConversation: (c) =>
    set((state) => {
      const idx = state.conversations.findIndex((existing) => existing.id === c.id);
      if (idx === -1) return { conversations: [c, ...state.conversations] };
      const next = state.conversations.slice();
      next[idx] = c;
      return { conversations: next };
    }),
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
