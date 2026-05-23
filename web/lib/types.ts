export type ListingStatus =
  | "matched"
  | "contacted"
  | "awaiting"
  | "scheduled"
  | "complete";

export interface Listing {
  id: string;
  address: string;
  neighborhood: string;
  pricePerMonth: number;
  beds: number;
  baths: number;
  sqftApprox: number;
  photos: string[];
  brokerName: string;
  brokerPhone: string;
  listedAt: Date;
  matchScore: number;
  status: ListingStatus;
  amenities: string[];
  noBrokerFee: boolean;
  description: string;
}

export interface Message {
  id: string;
  from: "agent" | "broker";
  body: string;
  timestamp: Date;
  receipt?: "delivered" | "read";
}

export type ConversationStatus = "awaiting" | "scheduled" | "complete";

export interface Conversation {
  id: string;
  listingId: string;
  brokerName: string;
  brokerPhone: string;
  messages: Message[];
  status: ConversationStatus;
  lastUpdated: Date;
  unread?: boolean;
}

export interface Viewing {
  id: string;
  listingId: string;
  address: string;
  brokerName: string;
  startTime: Date;
  endTime: Date;
}

export interface PersonalEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
}

export interface ActivityEntry {
  id: string;
  icon: "text" | "reply" | "booked" | "document" | "match";
  timestamp: Date;
  body: string;
}

export interface SearchCriteria {
  bedrooms: number | null;
  maxPrice: number | null;
  neighborhood: string | null;
  moveInDate: string | null;
  amenities: string[];
  dealBreakers: string[];
  readyToSearch: boolean;
}
