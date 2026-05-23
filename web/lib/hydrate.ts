import type { Listing, PipelineStats } from "./types";

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
  if (!res.ok) throw new Error(`Listings API ${res.status}`);
  const data = (await res.json()) as {
    listings: ApiListing[];
    serverTime?: string;
    source?: string;
  };
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
    body: JSON.stringify({ criteria, maxResults: 3 }),
  });
  return res.json();
}
