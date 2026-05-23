"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { RelativeTime } from "@/components/client-time";
import type { Listing, ListingStatus } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";

interface ListingCardProps {
  listing: Listing;
  index?: number;
  fresh?: boolean;
}

const STATUS_META: Record<
  ListingStatus,
  { label: string; variant: "green" | "blue" | "amber" | "purple" | "gray"; pulse?: boolean }
> = {
  matched: { label: "Just matched", variant: "green", pulse: true },
  contacted: { label: "Broker texted", variant: "blue" },
  awaiting: { label: "Awaiting reply", variant: "amber" },
  scheduled: { label: "Viewing scheduled", variant: "purple" },
  complete: { label: "Viewing complete", variant: "gray" },
};

export function ListingCard({ listing, index = 0, fresh = false }: ListingCardProps) {
  const status = STATUS_META[listing.status];
  const matchTone =
    listing.matchScore >= 80 ? "green" : listing.matchScore >= 60 ? "amber" : "red";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: fresh ? 0 : Math.min(index * 0.04, 0.4),
        ease: [0.22, 1, 0.36, 1],
      }}
      className="list-none"
    >
      <Link
        href={`/listing/${listing.id}`}
        className={cn(
          "group block overflow-hidden rounded-xl border border-rule bg-surface transition-all hover:border-rule-strong hover:shadow-md",
          fresh && "ring-2 ring-signal-green/40",
        )}
      >
        {/* Hero photo */}
        <div className="relative aspect-[4/3] overflow-hidden bg-surface-raised">
          <Image
            src={listing.photos[0]}
            alt={listing.address}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            unoptimized
          />
          {/* Match score badge */}
          <div className="absolute right-3 top-3">
            <MatchBadge score={listing.matchScore} tone={matchTone} />
          </div>
          {listing.noBrokerFee && (
            <div className="absolute left-3 top-3">
              <Badge variant="outline" className="bg-canvas/90 backdrop-blur-sm">
                No fee
              </Badge>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[15.5px] font-medium leading-tight text-ink">
                {listing.address}
              </h3>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">
                {listing.neighborhood}
              </p>
            </div>
            <div className="text-right">
              <p className="font-serif text-[20px] leading-none tabular tracking-tight text-ink">
                {formatPrice(listing.pricePerMonth)}
              </p>
              <p className="mt-1 text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">
                per month
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[12.5px] text-ink-muted">
            <span className="tabular">{listing.beds === 0 ? "Studio" : `${listing.beds} bd`}</span>
            <Dot />
            <span className="tabular">{listing.baths} ba</span>
            <Dot />
            <span className="tabular">{listing.sqftApprox} sqft</span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <StatusPill label={status.label} variant={status.variant} pulse={status.pulse} />
            <span className="text-[11.5px] text-ink-faint">
              <RelativeTime date={listing.listedAt} fallback="—" />
            </span>
          </div>
        </div>
      </Link>
    </motion.li>
  );
}

function Dot() {
  return <span aria-hidden className="h-1 w-1 rounded-full bg-rule-strong" />;
}

function MatchBadge({ score, tone }: { score: number; tone: "green" | "amber" | "red" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 backdrop-blur-md tabular",
        tone === "green" && "bg-signal-green/95 text-white",
        tone === "amber" && "bg-signal-amber/95 text-white",
        tone === "red" && "bg-signal-red/95 text-white",
      )}
    >
      <span className="font-serif text-[15px] leading-none tracking-tight">
        {score}
      </span>
      <span className="text-[10px] uppercase tracking-[0.1em] opacity-90">match</span>
    </div>
  );
}

export function StatusPill({
  label,
  variant,
  pulse = false,
}: {
  label: string;
  variant: "green" | "blue" | "amber" | "purple" | "gray";
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
        variant === "green" && "bg-signal-green-soft text-signal-green",
        variant === "blue" && "bg-signal-blue-soft text-signal-blue",
        variant === "amber" && "bg-signal-amber-soft text-signal-amber",
        variant === "purple" && "bg-signal-purple-soft text-signal-purple",
        variant === "gray" && "bg-signal-gray-soft text-signal-gray",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          variant === "green" && "bg-signal-green",
          variant === "blue" && "bg-signal-blue",
          variant === "amber" && "bg-signal-amber",
          variant === "purple" && "bg-signal-purple",
          variant === "gray" && "bg-signal-gray",
          pulse && "animate-pulse-soft",
        )}
      />
      {label}
    </span>
  );
}
