import type { Listing } from "./types";

/** Client-side listing identity (aligned with server normalizeUrl / post id). */
export function listingDisplayKey(listing: Listing): string {
  const raw = (listing.listingLink || listing.id).trim();
  if (!raw) return listing.id;
  try {
    const u = new URL(raw);
    u.hostname = u.hostname.toLowerCase();
    u.hash = "";
    let path = u.pathname.replace(/\/+$/, "") || "/";
    const clMatch = path.match(/(\d{8,})\.html$/i);
    if (clMatch) return `craigslist:post:${clMatch[1]}`;
    if (u.hostname.includes("streeteasy.com")) {
      return `streeteasy:path:${path.toLowerCase()}`;
    }
    return `${u.protocol}//${u.hostname}${path}`.toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/\/+$/, "");
  }
}

export function dedupeWebListings(listings: Listing[]): Listing[] {
  const byKey = new Map<string, Listing>();
  for (const row of listings) {
    const key = listingDisplayKey(row);
    const prev = byKey.get(key);
    if (!prev || row.listedAt.getTime() > prev.listedAt.getTime()) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

export const LISTINGS_POLL_MS = Number(
  process.env.NEXT_PUBLIC_LISTINGS_POLL_MS || 20_000,
);

export const FRESH_HIGHLIGHT_MS = 2 * 60_000;

export function diffNewListingIds(previous: Listing[], incoming: Listing[]): string[] {
  const prevKeys = new Set(previous.map(listingDisplayKey));
  return incoming
    .filter((l) => !prevKeys.has(listingDisplayKey(l)))
    .map((l) => l.id);
}

export function sortListingsForFeed(listings: Listing[], freshIds: string[]): Listing[] {
  const fresh = new Set(freshIds);
  return [...listings].sort((a, b) => {
    const aFresh = fresh.has(a.id) ? 1 : 0;
    const bFresh = fresh.has(b.id) ? 1 : 0;
    if (bFresh !== aFresh) return bFresh - aFresh;
    return b.listedAt.getTime() - a.listedAt.getTime();
  });
}

export function mergeListingSnapshots(
  existing: Listing[],
  incoming: Listing[],
): { merged: Listing[]; newIds: string[] } {
  const newIds = diffNewListingIds(existing, incoming);
  const byKey = new Map(existing.map((l) => [listingDisplayKey(l), l]));
  for (const row of incoming) {
    byKey.set(listingDisplayKey(row), row);
  }
  return { merged: dedupeWebListings([...byKey.values()]), newIds };
}
