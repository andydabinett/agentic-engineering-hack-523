"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Calendar,
  DollarSign,
  Plus,
  X,
  Sparkles,
  CheckCircle2,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import { triggerIngest, refreshListingsInStore, fetchPipelineStats } from "@/lib/hydrate";

const AMENITY_SUGGESTIONS = [
  "dishwasher",
  "laundry-in-unit",
  "laundry-in-building",
  "pet-friendly",
  "elevator",
  "doorman",
  "roof-deck",
  "gym",
  "exposed brick",
];

const DEAL_BREAKER_SUGGESTIONS = [
  "no-elevator",
  "broker-fee",
  "ground-floor",
  "no-pets",
  "no-laundry",
  "fee-agent",
];

export default function CriteriaPage() {
  const criteria = useAppStore((s) => s.criteria);
  const updateCriteria = useAppStore((s) => s.updateCriteria);
  const markReadyToSearch = useAppStore((s) => s.markReadyToSearch);

  const [newAmenity, setNewAmenity] = useState("");
  const [newDealBreaker, setNewDealBreaker] = useState("");
  const [ingesting, setIngesting] = useState(false);

  // Edit Handlers
  const setBedrooms = (beds: number | null) => {
    updateCriteria({ bedrooms: beds });
    toast.success(`Bedrooms updated to ${beds === 0 ? "Studio" : beds + " Bed"}`);
  };

  const setMaxPrice = (price: string) => {
    const val = price === "" ? null : Number(price);
    updateCriteria({ maxPrice: val });
  };

  const setNeighborhood = (name: string) => {
    updateCriteria({ neighborhood: name === "" ? null : name });
  };

  const setMoveInDate = (date: string) => {
    updateCriteria({ moveInDate: date === "" ? null : date });
  };

  // Tag Management
  const addAmenity = (name: string) => {
    const clean = name.trim().toLowerCase();
    if (!clean) return;
    if (criteria.amenities.includes(clean)) {
      toast.error("Amenity already added");
      return;
    }
    updateCriteria({ amenities: [...criteria.amenities, clean] });
    setNewAmenity("");
    toast.success(`Added must-have: ${clean}`);
  };

  const removeAmenity = (name: string) => {
    updateCriteria({
      amenities: criteria.amenities.filter((item) => item !== name),
    });
    toast.success(`Removed must-have: ${name}`);
  };

  const addDealBreaker = (name: string) => {
    const clean = name.trim().toLowerCase();
    if (!clean) return;
    if (criteria.dealBreakers.includes(clean)) {
      toast.error("Deal-breaker already added");
      return;
    }
    updateCriteria({ dealBreakers: [...criteria.dealBreakers, clean] });
    setNewDealBreaker("");
    toast.success(`Added deal-breaker: ${clean}`);
  };

  const removeDealBreaker = (name: string) => {
    updateCriteria({
      dealBreakers: criteria.dealBreakers.filter((item) => item !== name),
    });
    toast.success(`Removed deal-breaker: ${name}`);
  };

  const handleStartSearch = async () => {
    setIngesting(true);
    toast.message("Scanning Craigslist & StreetEasy…", {
      description: "Nimble search — usually a few seconds in demo mode.",
      duration: 30_000,
    });
    try {
      const result = await triggerIngest({
        ...criteria,
        readyToSearch: true,
      } as unknown as Record<string, unknown>);
      if (!result.ok) {
        toast.error("Scan failed", {
          description: result.error || result.stderr || "Check NIMBLE_API_KEY and Node 22.",
        });
        return;
      }
      markReadyToSearch();
      const { total, newIds, matches } = await refreshListingsInStore();
      const stats = await fetchPipelineStats();
      if (stats) {
        useAppStore.getState().setStatusCounts({
          listingsMonitored: stats.listingsMonitored,
          matches: stats.matches,
          brokersTexted: useAppStore.getState().conversations.length || stats.brokersTexted,
          viewingsScheduled: useAppStore.getState().viewings.length || stats.viewingsScheduled,
        });
      }
      const stored = result.storedTotal ?? 0;
      toast.success("Scan complete", {
        description:
          stored > 0
            ? `Indexed ${stored} from Nimble — ${newIds.length} new, ${matches} match your criteria (${total} total).`
            : `${total} listings in feed (${matches} match your criteria).`,
      });
    } catch {
      toast.error("Could not reach ingest API", {
        description: "Is Next running on Node 22?",
      });
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-8 pt-6 pb-12">
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            Active Search Preferences
          </p>
          <h1 className="mt-1 font-serif text-3xl leading-tight tracking-tight text-ink">
            My Criteria
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            The parameters Javier uses to crawl listings, message brokers, and schedule viewings.
          </p>
        </div>

        {/* Sync Status Info */}
        <div className="flex items-center gap-3 rounded-lg border border-signal-green/20 bg-signal-green-soft/40 px-4 py-2.5">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal-green opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-signal-green"></span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[12px] font-semibold text-signal-green">
              Synced with AI Agent
            </span>
            <span className="text-[10px] text-ink-muted">
              Javier is actively searching
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Core Criteria Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-xl border border-rule bg-surface p-6 shadow-sm">
            <h2 className="font-serif text-xl text-ink flex items-center gap-2">
              <Sliders className="h-5 w-5 text-accent" />
              Core Parameters
            </h2>
            <p className="text-xs text-ink-muted mt-1 mb-6">
              Adjust your main search constraints. Changing these instantly guides Javier&apos;s matches.
            </p>

            <div className="space-y-5">
              {/* Bedrooms Selection */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-ink-faint font-semibold block mb-2">
                  Bedrooms
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "Studio", val: 0 },
                    { label: "1 Bed", val: 1 },
                    { label: "2 Beds", val: 2 },
                    { label: "3 Beds", val: 3 },
                    { label: "Any", val: null },
                  ].map((btn) => {
                    const isSel = criteria.bedrooms === btn.val;
                    return (
                      <Button
                        key={btn.label}
                        type="button"
                        variant={isSel ? "accent" : "outline"}
                        onClick={() => setBedrooms(btn.val)}
                        className="h-9 text-xs"
                      >
                        {btn.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Price Limit */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-ink-faint font-semibold block mb-2">
                  Max Monthly Budget ($)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
                  <Input
                    type="number"
                    value={criteria.maxPrice || ""}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="Enter maximum rent"
                    className="pl-9 h-10 border-rule focus-visible:ring-accent/40"
                  />
                </div>
                <p className="text-[10px] text-ink-faint mt-1">
                  Example: 3800. Set blank for no limit.
                </p>
              </div>

              {/* Target Neighborhood */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-ink-faint font-semibold block mb-2">
                  Target Neighborhood
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
                  <Input
                    type="text"
                    value={criteria.neighborhood || ""}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="e.g. East Village, Williamsburg, Astoria"
                    className="pl-9 h-10 border-rule focus-visible:ring-accent/40"
                  />
                </div>
              </div>

              {/* Move-in Date */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-ink-faint font-semibold block mb-2">
                  Target Move-in Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
                  <Input
                    type="text"
                    value={criteria.moveInDate || ""}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    placeholder="e.g. June 1st, 2026"
                    className="pl-9 h-10 border-rule focus-visible:ring-accent/40"
                  />
                </div>
              </div>
            </div>

            {/* Run Search Update */}
            <div className="mt-8 pt-6 border-t border-rule flex items-center justify-between gap-4">
              <div className="text-xs text-ink-faint max-w-[60%]">
                Perform an immediate crawl scan of Craigslist & StreetEasy using these constraints.
              </div>
              <Button
                variant="accent"
                disabled={ingesting}
                onClick={handleStartSearch}
                className="h-10 text-xs px-5 flex items-center gap-1.5 shrink-0"
              >
                <Sparkles className="h-4 w-4" />
                {ingesting ? "Searching..." : "Scan listings now"}
              </Button>
            </div>
          </div>
        </div>

        {/* Must-Haves & Deal-Breakers Section */}
        <div className="lg:col-span-5 space-y-6">
          {/* Must-Haves */}
          <div className="rounded-xl border border-rule bg-surface p-6 shadow-sm">
            <h3 className="font-serif text-lg text-ink flex items-center gap-2">
              <CheckCircle2 className="h-4.5 w-4.5 text-accent" />
              Must-Have Amenities
            </h3>
            <p className="text-xs text-ink-muted mt-0.5 mb-4">
              Apartments without these tags will be filtered out.
            </p>

            {/* Add Amenity Form */}
            <div className="flex gap-2 mb-4">
              <Input
                type="text"
                placeholder="Add must-have (e.g. balcony)..."
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAmenity(newAmenity)}
                className="h-8 text-xs border-rule focus-visible:ring-accent/40"
              />
              <Button
                type="button"
                variant="subtle"
                size="sm"
                onClick={() => addAmenity(newAmenity)}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Suggestions list */}
            <div className="mb-4">
              <p className="text-[9px] uppercase tracking-wider text-ink-faint font-semibold mb-1.5">
                Suggestions:
              </p>
              <div className="flex flex-wrap gap-1">
                {AMENITY_SUGGESTIONS.filter(
                  (a) => !criteria.amenities.includes(a)
                ).slice(0, 5).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => addAmenity(a)}
                    className="text-[10px] px-2 py-0.5 rounded bg-surface-raised border border-rule hover:border-rule-strong hover:bg-rule/20 text-ink-muted transition-all"
                  >
                    + {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Amenities Chips */}
            <div className="min-h-12 border rounded-lg border-rule bg-canvas/30 p-3">
              {criteria.amenities.length === 0 ? (
                <p className="text-xs text-ink-faint italic text-center py-2">
                  No must-haves specified.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {criteria.amenities.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-deep border border-accent/15"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => removeAmenity(item)}
                        className="hover:bg-accent/10 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Deal-Breakers */}
          <div className="rounded-xl border border-rule bg-surface p-6 shadow-sm">
            <h3 className="font-serif text-lg text-ink flex items-center gap-2">
              <X className="h-4.5 w-4.5 text-accent" />
              Deal-Breakers
            </h3>
            <p className="text-xs text-ink-muted mt-0.5 mb-4">
              Javier will reject any apartments containing these characteristics.
            </p>

            {/* Add Deal-breaker Form */}
            <div className="flex gap-2 mb-4">
              <Input
                type="text"
                placeholder="Add deal-breaker (e.g. fee)..."
                value={newDealBreaker}
                onChange={(e) => setNewDealBreaker(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addDealBreaker(newDealBreaker)}
                className="h-8 text-xs border-rule focus-visible:ring-accent/40"
              />
              <Button
                type="button"
                variant="subtle"
                size="sm"
                onClick={() => addDealBreaker(newDealBreaker)}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Suggestions list */}
            <div className="mb-4">
              <p className="text-[9px] uppercase tracking-wider text-ink-faint font-semibold mb-1.5">
                Suggestions:
              </p>
              <div className="flex flex-wrap gap-1">
                {DEAL_BREAKER_SUGGESTIONS.filter(
                  (d) => !criteria.dealBreakers.includes(d)
                ).slice(0, 5).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => addDealBreaker(d)}
                    className="text-[10px] px-2 py-0.5 rounded bg-surface-raised border border-rule hover:border-rule-strong hover:bg-rule/20 text-ink-muted transition-all"
                  >
                    + {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Deal-breakers Chips */}
            <div className="min-h-12 border rounded-lg border-rule bg-canvas/30 p-3">
              {criteria.dealBreakers.length === 0 ? (
                <p className="text-xs text-ink-faint italic text-center py-2">
                  No deal-breakers specified.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {criteria.dealBreakers.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-ink-muted border border-rule line-through decoration-rule-strong"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => removeDealBreaker(item)}
                        className="hover:bg-rule-strong/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3 text-ink-faint group-hover:text-ink" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
