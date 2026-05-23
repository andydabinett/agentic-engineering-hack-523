import { toast } from "sonner";
import { fetchListingsFromApi, fetchPipelineStats } from "./hydrate";
import type { Listing, PipelineStats } from "./types";

type ScrapeStatus = {
  running: boolean;
  finishedAt: string | null;
  lastError: string | null;
};

export function pollUntilScrapeDone(
  onUpdate: (listings: Listing[], stats: PipelineStats | null) => void,
  {
    intervalMs = 12_000,
    maxAttempts = 45,
  } = {},
) {
  toast.message("Scraping listings…", {
    description: "Craigslist + StreetEasy — results will refresh automatically.",
  });

  let attempts = 0;
  const id = setInterval(async () => {
    attempts += 1;
    try {
      const statusRes = await fetch("/api/scrape/status");
      const status = (await statusRes.json()) as ScrapeStatus;

      if (!status.running && status.finishedAt) {
        clearInterval(id);
        const [listings, stats] = await Promise.all([
          fetchListingsFromApi(),
          fetchPipelineStats(),
        ]);
        onUpdate(listings, stats);
        if (status.lastError) {
          toast.error("Scrape failed", { description: status.lastError });
        } else {
          toast.success("Listings updated", {
            description: `${listings.length} listing(s) on the dashboard`,
          });
        }
        return;
      }
    } catch {
      /* retry */
    }

    if (attempts >= maxAttempts) {
      clearInterval(id);
      toast.message("Scrape still running", {
        description: "Refresh the dashboard in a few minutes.",
      });
    }
  }, intervalMs);

  return () => clearInterval(id);
}
