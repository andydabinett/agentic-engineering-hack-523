"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, MessageSquare, Phone } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListingGallery } from "@/components/listing-gallery";
import { FairPriceAnalysis } from "@/components/fair-price-analysis";
import { MessageThread } from "@/components/message-thread";
import { StatusPill } from "@/components/listing-card";
import { useAppStore } from "@/lib/store";
import { brokerInitials, cn, formatPrice } from "@/lib/utils";

const STATUS_LABEL = {
  matched: { label: "Just matched", variant: "green" as const },
  contacted: { label: "Broker texted", variant: "blue" as const },
  awaiting: { label: "Awaiting reply", variant: "amber" as const },
  scheduled: { label: "Viewing scheduled", variant: "purple" as const },
  complete: { label: "Viewing complete", variant: "gray" as const },
};

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const listings = useAppStore((s) => s.listings);
  const conversations = useAppStore((s) => s.conversations);

  const listing = listings.find((l) => l.id === params.id);
  if (!listing) return notFound();

  const conversation = conversations.find((c) => c.listingId === listing.id);
  const status = STATUS_LABEL[listing.status];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-8 pt-6 pb-12">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>
        <StatusPill label={status.label} variant={status.variant} />
      </div>

      {/* Heading */}
      <header className="mt-6 flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">
          {listing.neighborhood}
        </p>
        <h1 className="font-serif text-[40px] leading-[1.05] tracking-tight">
          {listing.address}
        </h1>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-serif text-[28px] leading-none tabular tracking-tight text-ink">
            {formatPrice(listing.pricePerMonth)}
            <span className="ml-1 text-[14px] font-sans text-ink-faint">/mo</span>
          </span>
          <span className="text-[14px] text-ink-muted tabular">
            {listing.beds === 0 ? "Studio" : `${listing.beds} bed`} · {listing.baths}{" "}
            bath · {listing.sqftApprox} sqft
          </span>
          {listing.noBrokerFee && (
            <Badge variant="outline" className="ml-1">
              No broker fee
            </Badge>
          )}
        </div>
      </header>

      {/* Gallery */}
      <div className="mt-7">
        <ListingGallery photos={listing.photos} alt={listing.address} />
      </div>

      {/* Two-column body */}
      <div className="mt-9 grid grid-cols-1 gap-7 lg:grid-cols-5">
        {/* LEFT 60% */}
        <div className="flex flex-col gap-7 lg:col-span-3">
          {/* Description */}
          <section className="rounded-xl border border-rule bg-surface px-6 pt-5 pb-6">
            <h2 className="font-serif text-xl leading-tight">About the unit</h2>
            <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.65] text-ink">
              {listing.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {listing.amenities.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center rounded-full bg-surface-raised px-2.5 py-1 text-[12px] text-ink-muted"
                >
                  {a}
                </span>
              ))}
            </div>
          </section>

          {/* Broker card */}
          <section className="rounded-xl border border-rule bg-surface px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11">
                  <AvatarFallback className="bg-accent-soft text-accent-deep text-[13px] font-medium">
                    {brokerInitials(listing.brokerName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[14px] font-semibold leading-tight">
                    {listing.brokerName}
                  </p>
                  <p className="mt-0.5 font-mono text-[12px] text-ink-faint">
                    {listing.brokerPhone}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
                asChild
              >
                <a href={`tel:${listing.brokerPhone.replace(/\D+/g, "")}`}>
                  <Phone className="h-3.5 w-3.5" />
                  Call
                </a>
              </Button>
            </div>
            {conversation && (
              <Link
                href={`/messages?conversation=${conversation.id}`}
                className={cn(
                  "mt-4 flex items-center gap-2 rounded-md border border-rule bg-canvas px-3 py-2 text-[12.5px] text-ink-muted transition-colors",
                  "hover:border-rule-strong hover:bg-surface-raised hover:text-ink",
                )}
              >
                <MessageSquare className="h-3.5 w-3.5 text-accent-deep" />
                <span>
                  Agent has texted this broker · view conversation →
                </span>
              </Link>
            )}
          </section>

          {/* Fair Price Analysis */}
          <FairPriceAnalysis listing={listing} />
        </div>

        {/* RIGHT 40% */}
        <div className="lg:col-span-2">
          <div className="h-[680px] lg:h-[760px]">
            {conversation ? (
              <MessageThread conversation={conversation} variant="embedded" showListingLink={false} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-rule bg-surface text-center px-8">
                <MessageSquare className="h-6 w-6 text-ink-faint" strokeWidth={1.5} />
                <h3 className="font-serif text-lg leading-tight">
                  Agent hasn&apos;t texted yet
                </h3>
                <p className="max-w-[36ch] text-[13px] text-ink-muted">
                  We&apos;ll open a thread with {listing.brokerName.split(" ")[0]}{" "}
                  the moment this listing graduates from matched to contacted.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
