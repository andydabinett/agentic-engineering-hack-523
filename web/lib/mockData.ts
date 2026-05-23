import type {
  ActivityEntry,
  Conversation,
  Listing,
  Message,
  PersonalEvent,
  Viewing,
  BookingNotification,
} from "./types";

/**
 * The reference timestamp for all mock data.
 * Computed once per process so SSR and client agree.
 * Relative-time UI should still be rendered client-only to avoid drift.
 */
export const NOW = new Date();

const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);
const hoursAgo = (n: number) => minutesAgo(n * 60);

/**
 * Returns a Date at `time` (HH:mm) on the next occurrence of `weekday`
 * (0=Sun … 6=Sat) at or after NOW.
 */
function nextWeekday(weekday: number, hour: number, minute = 0): Date {
  const d = new Date(NOW);
  const delta = (weekday + 7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + delta);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function thisWeek(weekday: number, hour: number, minute = 0): Date {
  // Same week (Mon-based shift would be tricky); use offset from current weekday.
  const d = new Date(NOW);
  const delta = weekday - d.getDay();
  d.setDate(d.getDate() + delta);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const PHOTOS = [
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=1600&q=80",
];

function photos(start: number, count = 5): string[] {
  return Array.from({ length: count }, (_, i) => PHOTOS[(start + i) % PHOTOS.length]);
}

export const listings: Listing[] = [
  // --- scheduled (3) ---
  {
    id: "listing-1",
    address: "234 E 10th St #4B",
    neighborhood: "East Village",
    pricePerMonth: 3650,
    beds: 1,
    baths: 1,
    sqftApprox: 620,
    photos: photos(0, 5),
    brokerName: "Jamie Carter",
    brokerPhone: "(917) 555-0142",
    listedAt: hoursAgo(28),
    matchScore: 92,
    status: "scheduled",
    amenities: ["dishwasher", "laundry-in-building", "pet-friendly", "exposed brick"],
    noBrokerFee: true,
    description:
      "South-facing one-bedroom on a quiet block between 2nd and 3rd Ave. Original hardwood, exposed brick along the living room wall, and a recently renovated kitchen with full-size appliances. Building is rent-stabilized.",
  },
  {
    id: "listing-2",
    address: "511 E 7th St #2C",
    neighborhood: "East Village",
    pricePerMonth: 3950,
    beds: 1,
    baths: 1,
    sqftApprox: 700,
    photos: photos(1, 5),
    brokerName: "Priya Aggarwal",
    brokerPhone: "(646) 555-0917",
    listedAt: hoursAgo(40),
    matchScore: 88,
    status: "scheduled",
    amenities: ["elevator", "laundry-in-building", "dishwasher", "pet-friendly"],
    noBrokerFee: true,
    description:
      "Spacious 1BR in a well-kept walk-up between Ave A and Ave B. Renovated bathroom, generous closets, and oversized windows. A short walk to Tompkins Square Park.",
  },
  {
    id: "listing-3",
    address: "17 St Marks Pl #3R",
    neighborhood: "East Village",
    pricePerMonth: 4200,
    beds: 1,
    baths: 1,
    sqftApprox: 740,
    photos: photos(2, 5),
    brokerName: "Daniel Okafor",
    brokerPhone: "(212) 555-0488",
    listedAt: hoursAgo(60),
    matchScore: 84,
    status: "scheduled",
    amenities: ["dishwasher", "laundry-in-unit", "pet-friendly", "exposed brick"],
    noBrokerFee: false,
    description:
      "Rear-facing 1BR above the famous St Marks Place strip. Surprisingly quiet given the location, with a roomy galley kitchen and in-unit washer/dryer.",
  },

  // --- complete (1) ---
  {
    id: "listing-4",
    address: "122 Ave A #3R",
    neighborhood: "East Village",
    pricePerMonth: 3450,
    beds: 1,
    baths: 1,
    sqftApprox: 580,
    photos: photos(3, 5),
    brokerName: "Lena Goldfarb",
    brokerPhone: "(917) 555-0231",
    listedAt: hoursAgo(74),
    matchScore: 71,
    status: "complete",
    amenities: ["dishwasher", "laundry-in-building", "elevator"],
    noBrokerFee: true,
    description:
      "Compact but bright 1BR a block from Tompkins Square. Good closet space, decent natural light, somewhat dated bathroom fittings.",
  },

  // --- awaiting (2) ---
  {
    id: "listing-5",
    address: "88 Stuyvesant St #5",
    neighborhood: "East Village",
    pricePerMonth: 4350,
    beds: 1,
    baths: 1,
    sqftApprox: 760,
    photos: photos(4, 5),
    brokerName: "Marcus Reyes",
    brokerPhone: "(646) 555-0364",
    listedAt: hoursAgo(18),
    matchScore: 86,
    status: "awaiting",
    amenities: ["dishwasher", "laundry-in-unit", "exposed brick", "high ceilings"],
    noBrokerFee: false,
    description:
      "Unusual angled layout on a one-block street between 2nd and 3rd Ave. High ceilings, a working fireplace, and beautifully restored hardwood throughout.",
  },
  {
    id: "listing-6",
    address: "345 E 4th St #1A",
    neighborhood: "East Village",
    pricePerMonth: 3200,
    beds: 0,
    baths: 1,
    sqftApprox: 450,
    photos: photos(5, 4),
    brokerName: "Mei Chen",
    brokerPhone: "(212) 555-0789",
    listedAt: hoursAgo(11),
    matchScore: 78,
    status: "awaiting",
    amenities: ["dishwasher", "laundry-in-building", "pet-friendly"],
    noBrokerFee: true,
    description:
      "Garden-level studio with a private outdoor area off the back. The layout makes the most of the square footage with a defined sleeping nook.",
  },

  // --- contacted (3) ---
  {
    id: "listing-7",
    address: "67 1st Ave #4F",
    neighborhood: "East Village",
    pricePerMonth: 3800,
    beds: 1,
    baths: 1,
    sqftApprox: 660,
    photos: photos(0, 4),
    brokerName: "Sebastian Park",
    brokerPhone: "(917) 555-0125",
    listedAt: hoursAgo(5),
    matchScore: 81,
    status: "contacted",
    amenities: ["dishwasher", "elevator", "doorman"],
    noBrokerFee: false,
    description:
      "Doorman building rare for the neighborhood. Compact 1BR with a south-facing exposure and brand-new kitchen.",
  },
  {
    id: "listing-8",
    address: "432 Ave B #2W",
    neighborhood: "East Village",
    pricePerMonth: 3100,
    beds: 0,
    baths: 1,
    sqftApprox: 420,
    photos: photos(2, 4),
    brokerName: "Hannah Berger",
    brokerPhone: "(646) 555-0541",
    listedAt: hoursAgo(7),
    matchScore: 74,
    status: "contacted",
    amenities: ["laundry-in-building", "pet-friendly", "exposed brick"],
    noBrokerFee: true,
    description:
      "Loft-feeling studio with double-height ceilings in one section. Tucked above a small bookstore on a quieter stretch of Ave B.",
  },
  {
    id: "listing-9",
    address: "12 Cooper Sq #6E",
    neighborhood: "East Village",
    pricePerMonth: 4500,
    beds: 1,
    baths: 1,
    sqftApprox: 820,
    photos: photos(4, 5),
    brokerName: "Ravi Kapoor",
    brokerPhone: "(917) 555-0903",
    listedAt: hoursAgo(9),
    matchScore: 90,
    status: "contacted",
    amenities: ["dishwasher", "laundry-in-unit", "elevator", "gym", "roof-deck"],
    noBrokerFee: false,
    description:
      "Top-floor 1BR in a modern building with sweeping views toward the Bowery. Floor-to-ceiling windows, central air, and access to the building's roof deck.",
  },

  // --- matched (3) — listed within last hour ---
  {
    id: "listing-10",
    address: "209 E 7th St #3A",
    neighborhood: "East Village",
    pricePerMonth: 3550,
    beds: 1,
    baths: 1,
    sqftApprox: 610,
    photos: photos(1, 4),
    brokerName: "Tomás Beltran",
    brokerPhone: "(646) 555-0274",
    listedAt: minutesAgo(11),
    matchScore: 89,
    status: "matched",
    amenities: ["dishwasher", "laundry-in-building", "pet-friendly"],
    noBrokerFee: true,
    description:
      "Just-listed 1BR between Ave A and 1st Ave. Renovated last year, pre-war details intact, washer/dryer on the floor.",
  },
  {
    id: "listing-11",
    address: "78 1st Ave #5C",
    neighborhood: "East Village",
    pricePerMonth: 3725,
    beds: 1,
    baths: 1,
    sqftApprox: 640,
    photos: photos(3, 4),
    brokerName: "Olivia Sharma",
    brokerPhone: "(212) 555-0610",
    listedAt: minutesAgo(28),
    matchScore: 82,
    status: "matched",
    amenities: ["elevator", "dishwasher", "laundry-in-building"],
    noBrokerFee: false,
    description:
      "Bright corner 1BR with eastern and southern exposures. Newer building with elevator and shared laundry on every floor.",
  },
  {
    id: "listing-12",
    address: "414 E 10th St #2F",
    neighborhood: "East Village",
    pricePerMonth: 4100,
    beds: 1,
    baths: 1,
    sqftApprox: 680,
    photos: photos(5, 4),
    brokerName: "Andrei Mikhailov",
    brokerPhone: "(917) 555-0488",
    listedAt: minutesAgo(46),
    matchScore: 76,
    status: "matched",
    amenities: ["dishwasher", "laundry-in-unit", "exposed brick"],
    noBrokerFee: true,
    description:
      "Renovated 1BR with in-unit laundry, dishwasher, and a deep walk-in closet. Quiet rear-facing unit.",
  },
];

let messageIdCounter = 0;
const nextMessageId = () => `msg-${++messageIdCounter}`;

function msg(
  from: "agent" | "broker",
  body: string,
  timestamp: Date,
  receipt?: Message["receipt"],
): Message {
  return { id: nextMessageId(), from, body, timestamp, receipt };
}

// Pick base "wednesday" anchor for the canonical convo so day labels look natural.
const wedAnchor = (() => {
  const d = new Date(NOW);
  const delta = (3 + 7 - d.getDay()) % 7; // next Wednesday (could be today)
  d.setDate(d.getDate() + (delta === 0 && d.getHours() > 18 ? 7 : delta));
  d.setHours(17, 32, 0, 0);
  return d;
})();

const offset = (base: Date, mins: number) =>
  new Date(base.getTime() + mins * 60_000);

export const conversations: Conversation[] = [
  // --- listing-1 / Jamie — scheduled (canonical) ---
  {
    id: "conv-1",
    listingId: "listing-1",
    brokerName: "Jamie Carter",
    brokerPhone: "(917) 555-0142",
    status: "scheduled",
    lastUpdated: offset(wedAnchor, 10),
    messages: [
      msg(
        "agent",
        "Hi Jamie — interested in 234 E 10th St #4B. Avail Tue 6, Wed 5, or Thu after 6?",
        wedAnchor,
        "read",
      ),
      msg("broker", "Tue 6 works. Meet at front door.", offset(wedAnchor, 9)),
      msg(
        "agent",
        "Confirmed Tue 6pm. Calendar invite sent.",
        offset(wedAnchor, 10),
        "read",
      ),
    ],
  },
  // --- listing-2 / Priya — scheduled ---
  {
    id: "conv-2",
    listingId: "listing-2",
    brokerName: "Priya Aggarwal",
    brokerPhone: "(646) 555-0917",
    status: "scheduled",
    lastUpdated: hoursAgo(3),
    messages: [
      msg(
        "agent",
        "Hi Priya — Alex is interested in 511 E 7th #2C. Any showings this week?",
        hoursAgo(8),
        "read",
      ),
      msg(
        "broker",
        "Hi! Thursday 5:30 or Friday 11am both open.",
        hoursAgo(6),
      ),
      msg(
        "agent",
        "Thursday 5:30 works. Address & cross-streets confirmed.",
        hoursAgo(5),
        "read",
      ),
      msg("broker", "Great — bring photo ID. See you then.", hoursAgo(3)),
    ],
  },
  // --- listing-5 / Marcus — awaiting ---
  {
    id: "conv-3",
    listingId: "listing-5",
    brokerName: "Marcus Reyes",
    brokerPhone: "(646) 555-0364",
    status: "awaiting",
    lastUpdated: hoursAgo(2),
    unread: false,
    messages: [
      msg(
        "agent",
        "Hi Marcus — interested in 88 Stuyvesant St #5. Could we look this week? Eve avail Wed/Thu/Fri after 5.",
        hoursAgo(2),
        "delivered",
      ),
    ],
  },
  // --- listing-4 / Lena — complete (past viewing) ---
  {
    id: "conv-4",
    listingId: "listing-4",
    brokerName: "Lena Goldfarb",
    brokerPhone: "(917) 555-0231",
    status: "complete",
    lastUpdated: hoursAgo(20),
    messages: [
      msg(
        "agent",
        "Hi Lena — Alex would like to see 122 Ave A #3R.",
        hoursAgo(72),
        "read",
      ),
      msg(
        "broker",
        "How about Saturday 11am? I'll be on-site.",
        hoursAgo(70),
      ),
      msg(
        "agent",
        "Saturday 11am works. Calendar invite on the way.",
        hoursAgo(69),
        "read",
      ),
      msg("broker", "Confirmed. See you then.", hoursAgo(68)),
      msg(
        "agent",
        "Thanks for showing the unit. Alex has feedback — will follow up.",
        hoursAgo(20),
        "read",
      ),
    ],
  },
];

export const viewings: Viewing[] = [
  {
    id: "viewing-1",
    listingId: "listing-1",
    address: "234 E 10th St #4B",
    brokerName: "Jamie Carter",
    startTime: nextWeekday(2, 18, 0), // Tue 6:00 pm
    endTime: nextWeekday(2, 18, 30),
  },
  {
    id: "viewing-2",
    listingId: "listing-2",
    address: "511 E 7th St #2C",
    brokerName: "Priya Aggarwal",
    startTime: nextWeekday(4, 17, 30), // Thu 5:30 pm
    endTime: nextWeekday(4, 18, 0),
  },
  {
    id: "viewing-3",
    listingId: "listing-3",
    address: "17 St Marks Pl #3R",
    brokerName: "Daniel Okafor",
    startTime: nextWeekday(6, 11, 0), // Sat 11:00 am
    endTime: nextWeekday(6, 11, 30),
  },
];

export const personalEvents: PersonalEvent[] = [
  {
    id: "personal-1",
    title: "Lunch with Sam",
    startTime: thisWeek(1, 12, 30), // Mon 12:30
    endTime: thisWeek(1, 13, 30),
  },
  {
    id: "personal-2",
    title: "Standup",
    startTime: thisWeek(2, 9, 0), // Tue 9am
    endTime: thisWeek(2, 9, 30),
  },
  {
    id: "personal-3",
    title: "Standup",
    startTime: thisWeek(4, 9, 0), // Thu 9am
    endTime: thisWeek(4, 9, 30),
  },
  {
    id: "personal-4",
    title: "Therapy",
    startTime: thisWeek(4, 19, 0), // Thu 7pm
    endTime: thisWeek(4, 20, 0),
  },
];

export const initialActivityFeed: ActivityEntry[] = [
  {
    id: "act-1",
    icon: "document",
    timestamp: minutesAgo(8),
    body: "Fair Price Analysis published for 234 E 10th St",
  },
  {
    id: "act-2",
    icon: "booked",
    timestamp: minutesAgo(18),
    body: "Viewing confirmed for Tue 6pm with Jamie Carter",
  },
  {
    id: "act-3",
    icon: "reply",
    timestamp: minutesAgo(19),
    body: "Jamie replied — Tuesday 6pm proposed",
  },
  {
    id: "act-4",
    icon: "text",
    timestamp: minutesAgo(28),
    body: "Agent texted Jamie about 234 E 10th St",
  },
  {
    id: "act-5",
    icon: "match",
    timestamp: minutesAgo(35),
    body: "New match: 414 E 10th St #2F · 76 score",
  },
  {
    id: "act-6",
    icon: "text",
    timestamp: hoursAgo(2),
    body: "Agent texted Marcus about 88 Stuyvesant St",
  },
];

/**
 * Initial counts shown in the dashboard status bar before the demo sequence.
 * The animated tick effect counts up to these.
 */
export const initialStatusCounts = {
  listingsMonitored: 312,
  matches: 4,
  brokersTexted: 2,
  viewingsScheduled: 3,
};

/**
 * Used by the demo sequence (Cmd+Shift+D): a brand-new listing that animates
 * into the dashboard with a freshly-matched broker conversation.
 */
export const demoListing: Listing = {
  id: "listing-demo",
  address: "129 St Marks Pl #2F",
  neighborhood: "East Village",
  pricePerMonth: 3825,
  beds: 1,
  baths: 1,
  sqftApprox: 655,
  photos: photos(2, 5),
  brokerName: "Naomi Singh",
  brokerPhone: "(917) 555-0188",
  listedAt: minutesAgo(0),
  matchScore: 94,
  status: "matched",
  amenities: ["dishwasher", "laundry-in-building", "pet-friendly", "elevator"],
  noBrokerFee: true,
  description:
    "Just-listed 1BR on St Marks with elevator access and a renovated kitchen. Pet-friendly building with shared laundry.",
};

export const demoBroker = {
  name: "Naomi Singh",
  phone: "(917) 555-0188",
  listingId: "listing-demo",
};

export const notifications: BookingNotification[] = [
  {
    id: "notif-1",
    viewingId: "viewing-2",
    address: "511 E 7th St #2C",
    brokerName: "Priya Aggarwal",
    startTime: nextWeekday(4, 17, 30),
    timestamp: minutesAgo(18),
    read: false,
  },
  {
    id: "notif-2",
    viewingId: "viewing-1",
    address: "234 E 10th St #4B",
    brokerName: "Jamie Carter",
    startTime: nextWeekday(2, 18, 0),
    timestamp: hoursAgo(2),
    read: true,
  },
];
