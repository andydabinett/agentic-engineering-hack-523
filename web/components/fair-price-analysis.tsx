"use client";

import { ArrowUpRight, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Listing } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

interface FairPriceAnalysisProps {
  listing: Listing;
}

/**
 * Editorial-styled analysis block. Numbers are derived from the listing
 * so the math actually adds up for the demo: building median is set so
 * the verdict shows the listing as ~8% below median.
 */
export function FairPriceAnalysis({ listing }: FairPriceAnalysisProps) {
  const buildingMedian = Math.round(listing.pricePerMonth / 0.92);
  const percentBelow = Math.round(
    ((buildingMedian - listing.pricePerMonth) / buildingMedian) * 100,
  );
  const pricePerSqft = (listing.pricePerMonth / listing.sqftApprox).toFixed(2);
  const neighborhoodPpsf = (listing.pricePerMonth * 1.05 / listing.sqftApprox).toFixed(2);

  const sources = [
    `StreetEasy comps, ${listing.address.split("#")[0].trim()} (last 18 mo)`,
    "NYC DOB violations, BIN 1004562",
    "Broker license, NY DOS #10311208XXXX",
  ];

  return (
    <section
      aria-labelledby="fpa-heading"
      className="overflow-hidden rounded-xl border border-rule bg-surface"
    >
      <header className="flex items-baseline justify-between border-b border-rule px-6 pt-5 pb-4">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            Agent analysis
          </span>
          <h2 id="fpa-heading" className="mt-1 font-serif text-2xl leading-tight tracking-tight">
            Fair Price Analysis
          </h2>
        </div>
        <span className="hidden text-[11.5px] text-ink-faint sm:inline">
          Generated <span className="tabular">~3 min ago</span>
        </span>
      </header>

      <div className="px-6 pt-6 pb-5">
        {/* Verdict line */}
        <p className="font-serif text-[22px] leading-snug text-ink">
          Listed at{" "}
          <span className="font-semibold tabular">{formatPrice(listing.pricePerMonth)}</span>{" "}
          —{" "}
          <span className="text-accent-deep">
            {percentBelow}% below building median
          </span>
          .
        </p>

        {/* Paragraphs */}
        <div className="mt-5 space-y-4 max-w-[64ch] text-[14.5px] leading-[1.65] text-ink">
          <p>
            The current ask of {formatPrice(listing.pricePerMonth)}/mo prices the
            unit at ${pricePerSqft}/sqft. Comparable {listing.beds === 0 ? "studios" : `${listing.beds}-bedroom units`}{" "}
            in the building have transacted between{" "}
            <span className="tabular">{formatPrice(Math.round(buildingMedian * 0.97))}</span>{" "}
            and{" "}
            <span className="tabular">{formatPrice(Math.round(buildingMedian * 1.08))}</span>{" "}
            over the last eighteen months, putting this listing meaningfully
            below the in-building median<Cite n={1} source={sources[0]} />.
          </p>
          <p>
            On a per-square-foot basis the listing also sits below the
            neighborhood median for {listing.neighborhood} of
            ~${neighborhoodPpsf}/sqft, which suggests the asking price is
            not just a building-specific deal but a genuine outlier for the
            area. The building has no open Class C violations and a clean
            HPD record going back five years<Cite n={2} source={sources[1]} />.
          </p>
          <p>
            Listing broker {listing.brokerName} is licensed in good
            standing and has represented this address since 2022, which
            typically correlates with faster response times and accurate
            unit information<Cite n={3} source={sources[2]} />.
          </p>
          <p className="text-ink-muted">
            Recommendation: Tour promptly. Units at this price-to-median
            spread on {listing.address.split("#")[0].trim()}have historically gone
            into contract within 6&ndash;9 days of listing.
          </p>
        </div>

        {/* Citations list */}
        <ol className="mt-6 grid gap-1.5 border-t border-rule pt-4 text-[12px] text-ink-muted">
          {sources.map((s, i) => (
            <li key={s} className="flex gap-2">
              <span className="font-mono text-[10.5px] text-ink-faint w-5 shrink-0">
                [{i + 1}]
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-rule bg-canvas px-6 py-3 text-[12px] text-ink-muted">
        <span className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" />
          Published to{" "}
          <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[11.5px]">
            cited.md
          </code>
        </span>
        <a
          href="#"
          className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
        >
          View source <ArrowUpRight className="h-3 w-3" />
        </a>
      </footer>
    </section>
  );
}

function Cite({ n, source }: { n: number; source: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <sup className="ml-0.5 cursor-help font-mono text-[10px] text-accent-deep underline-offset-2 hover:underline">
          [{n}]
        </sup>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-left">
        {source}
      </TooltipContent>
    </Tooltip>
  );
}
