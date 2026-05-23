import type { Listing, PipelineStats } from "./types";
import { diffNewListingIds } from "./liveListings";

type ApiListing = Omit<Listing, "listedAt"> & { listedAt: string };

function reviveListing(row: ApiListing): Listing {
  return {
    ...row,
    listedAt: new Date(row.listedAt),
  };
}

export function isDemoMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("demo") === "1";
}

export type ListingsFetchResult = {
  listings: Listing[];
  serverTime: string;
  source?: string;
};

export async function fetchListingsFromApi(opts?: {
  since?: string;
}): Promise<ListingsFetchResult> {
  const qs = opts?.since ? `?since=${encodeURIComponent(opts.since)}` : "";
  const res = await fetch(`/api/listings${qs}`, { cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as {
    listings?: ApiListing[];
    serverTime?: string;
    source?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `Listings API ${res.status}`);
  }
  return {
    listings: (data.listings || []).map(reviveListing),
    serverTime: data.serverTime || new Date().toISOString(),
    source: data.source,
  };
}

export async function fetchPipelineStats(): Promise<PipelineStats | null> {
  const res = await fetch("/api/pipeline/stats");
  if (!res.ok) return null;
  const data = (await res.json()) as { stats: PipelineStats };
  return data.stats ?? null;
}

export async function triggerIngest(criteria?: Record<string, unknown>) {
  const res = await fetch("/api/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ criteria, maxResults: 8 }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error:
        (payload as { error?: string }).error ||
        (payload as { stderr?: string }).stderr ||
        `Ingest API ${res.status}`,
      stderr: (payload as { stderr?: string }).stderr,
    };
  }
  return payload as {
    ok?: boolean;
    storedTotal?: number;
    stdout?: string;
    stderr?: string;
    error?: string;
  };
}

/** Pull latest SQLite listings into the dashboard store after ingest. */
export async function refreshListingsInStore(): Promise<{
  total: number;
  newIds: string[];
  matches: number;
}> {
  const { useAppStore } = await import("./store");
  const { listingMatchesCriteria } = await import("./matchesCriteria");
  const prev = useAppStore.getState().listings;
  const { listings: incoming } = await fetchListingsFromApi();
  const newIds = diffNewListingIds(prev, incoming);
  if (newIds.length > 0) {
    useAppStore.getState().mergeLiveListings(incoming, newIds);
  } else {
    useAppStore.getState().setListings(incoming);
  }
  const criteria = useAppStore.getState().criteria;
  const matches = incoming.filter((l) => listingMatchesCriteria(l, criteria)).length;
  return { total: incoming.length, newIds, matches };
}
