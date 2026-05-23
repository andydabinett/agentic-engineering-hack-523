"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDays,
  subDays,
  format,
  isSameDay,
  isToday,
  startOfWeek,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, User, ChevronLeft, ChevronRight, Calendar, X, ExternalLink, CalendarCheck } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { PersonalEvent, Viewing } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 21; // 9pm exclusive end
const HOUR_HEIGHT_PX = 64;
const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR;

type Block =
  | { kind: "viewing"; ev: Viewing }
  | { kind: "personal"; ev: PersonalEvent };

export function CalendarGrid() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-ink-muted bg-surface rounded-xl border border-rule">Loading calendar...</div>}>
      <CalendarGridContent />
    </Suspense>
  );
}

function CalendarGridContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewings = useAppStore((s) => s.viewings);
  const personal = useAppStore((s) => s.personalEvents);
  const listings = useAppStore((s) => s.listings);

  const [viewedDate, setViewedDate] = useState(() => new Date());
  const weekStart = useMemo(() => startOfWeek(viewedDate, { weekStartsOn: 1 }), [viewedDate]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const hours = useMemo(
    () => Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START_HOUR + i),
    [],
  );

  const [selectedViewing, setSelectedViewing] = useState<Viewing | null>(null);
  const selectedListing = useMemo(() => {
    if (!selectedViewing) return null;
    return listings.find((l) => l.id === selectedViewing.listingId);
  }, [selectedViewing, listings]);

  const viewingIdParam = searchParams.get("viewing");
  useEffect(() => {
    if (viewingIdParam) {
      const found = viewings.find((v) => v.id === viewingIdParam);
      if (found) {
        setSelectedViewing(found);
        setViewedDate(new Date(found.startTime));
      }
    }
  }, [viewingIdParam, viewings]);

  const weekRangeLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    if (weekStart.getMonth() === end.getMonth()) {
      return `${format(weekStart, "MMMM d")} – ${format(end, "d, yyyy")}`;
    } else if (weekStart.getFullYear() === end.getFullYear()) {
      return `${format(weekStart, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
    } else {
      return `${format(weekStart, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
    }
  }, [weekStart]);

  const handlePrevWeek = () => {
    setViewedDate((prev) => subDays(prev, 7));
  };
  const handleNextWeek = () => {
    setViewedDate((prev) => addDays(prev, 7));
  };
  const handleToday = () => {
    setViewedDate(new Date());
  };

  const blocksByDay = useMemo<Block[][]>(() => {
    return days.map((d) => {
      const dayBlocks: Block[] = [];
      for (const v of viewings) {
        if (isSameDay(new Date(v.startTime), d)) {
          dayBlocks.push({ kind: "viewing", ev: v });
        }
      }
      for (const p of personal) {
        if (isSameDay(new Date(p.startTime), d)) {
          dayBlocks.push({ kind: "personal", ev: p });
        }
      }
      return dayBlocks.sort((a, b) =>
        getStart(a).getTime() - getStart(b).getTime(),
      );
    });
  }, [days, personal, viewings]);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl border border-rule bg-surface">
        {/* Navigation Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-rule bg-surface-raised/40">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevWeek}
              className="h-8 w-8 p-0"
              title="Previous Week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="h-8 px-3 text-xs"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextWeek}
              className="h-8 w-8 p-0"
              title="Next Week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 text-ink">
            <Calendar className="h-4 w-4 text-accent" strokeWidth={2} />
            <span className="font-serif text-lg leading-none tracking-tight font-medium">
              {weekRangeLabel}
            </span>
          </div>
        </div>

        {/* Day header */}
        <div
          className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] border-b border-rule"
        >
          <div className="px-3 py-3 text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            Week
          </div>
          {days.map((d) => {
            const today = isToday(d);
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  "border-l border-rule px-3 py-3",
                  today && "bg-accent-soft/40",
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
                    {format(d, "EEE")}
                  </span>
                  <span
                    className={cn(
                      "font-serif text-lg leading-none tabular tracking-tight",
                      today ? "text-accent-deep" : "text-ink",
                    )}
                  >
                    {format(d, "d")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="relative">
          <div
            className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))]"
            style={{ height: TOTAL_HOURS * HOUR_HEIGHT_PX }}
          >
            {/* Hour labels */}
            <div className="relative border-r border-rule">
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute right-3 -translate-y-2 text-[10.5px] tabular text-ink-faint"
                  style={{ top: i * HOUR_HEIGHT_PX }}
                >
                  {format12(h)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((d, dayIdx) => (
              <div key={d.toISOString()} className="relative border-l border-rule">
                {/* Hour lines */}
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className={cn(
                      "absolute inset-x-0 border-t",
                      i === 0
                        ? "border-transparent"
                        : "border-rule/60",
                    )}
                    style={{ top: i * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
                  />
                ))}

                {/* Events */}
                {blocksByDay[dayIdx].map((b) => (
                  <EventBlock
                    key={blockKey(b)}
                    block={b}
                    onOpenViewing={setSelectedViewing}
                  />
                ))}

                {/* Now-line on today */}
                {isToday(d) && <NowLine />}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-5 border-t border-rule px-5 py-3 text-[12px] text-ink-muted">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="h-2 w-2 rounded-sm bg-accent" />
            Apartment viewings
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 rounded-sm bg-rule-strong"
            />
            Personal
          </span>
        </div>
      </div>

      {/* Viewing Details Modal */}
      <AnimatePresence>
        {selectedViewing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedViewing(null)}
              className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            />
            {/* Content card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-md overflow-hidden rounded-xl border border-rule bg-canvas shadow-2xl z-10"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedViewing(null)}
                className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-canvas/80 text-ink-muted backdrop-blur-sm border border-rule transition-colors hover:bg-surface-raised hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Photo Banner */}
              <div className="relative h-48 w-full bg-surface-raised">
                {selectedListing?.photos?.[0] ? (
                  <img
                    src={selectedListing.photos[0]}
                    alt={selectedViewing.address}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink-faint">
                    <Building2 className="h-10 w-10" />
                  </div>
                )}
                {/* Score badge & Price badge overlay */}
                {selectedListing && (
                  <div className="absolute bottom-3 inset-x-3 flex items-center justify-between">
                    <div className="rounded bg-accent px-2 py-0.5 text-xs font-semibold text-white tracking-wide">
                      {selectedListing.matchScore}% Score
                    </div>
                    <div className="rounded bg-ink px-2 py-0.5 text-sm font-serif tabular font-semibold text-canvas">
                      ${selectedListing.pricePerMonth}/mo
                    </div>
                  </div>
                )}
              </div>

              {/* Content body */}
              <div className="p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-accent flex items-center gap-1">
                  <CalendarCheck className="h-3 w-3" />
                  Viewing Appointment
                </p>
                <h3 className="mt-1 font-serif text-xl leading-snug tracking-tight text-ink">
                  {selectedViewing.address}
                </h3>
                {selectedListing && (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {selectedListing.beds} bed · {selectedListing.baths} bath · {selectedListing.sqftApprox} sqft · {selectedListing.neighborhood}
                  </p>
                )}

                {/* Separator */}
                <hr className="my-3 border-rule" />

                {/* Event Schedule Info */}
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-accent-soft text-accent">
                      <Calendar className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-faint">
                        Schedule
                      </p>
                      <p className="text-xs font-medium text-ink mt-0.5">
                        {format(new Date(selectedViewing.startTime), "eeee, MMMM d, yyyy")}
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        {format(new Date(selectedViewing.startTime), "h:mm a")} – {format(new Date(selectedViewing.endTime), "h:mm a")}
                      </p>
                    </div>
                  </div>

                  {/* AI Concierge Info */}
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-accent-soft text-accent">
                      <Building2 className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-faint">
                        Concierge Coordinator
                      </p>
                      <p className="text-xs font-medium text-ink mt-0.5">
                        Javier (AI Concierge)
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        Negotiated and booked automatically based on your preferences.
                      </p>
                    </div>
                  </div>

                  {/* Broker Contact */}
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-accent-soft text-accent">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-faint">
                        Contact Broker
                      </p>
                      <p className="text-xs font-medium text-ink mt-0.5">
                        {selectedViewing.brokerName}
                      </p>
                      {selectedListing?.brokerPhone && (
                        <p className="text-[11px] text-ink-muted">
                          Phone: {selectedListing.brokerPhone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Separator */}
                <hr className="my-3 border-rule" />

                {/* Description */}
                {selectedListing?.description && (
                  <div className="mb-4">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-faint">
                      Listing Description
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted line-clamp-2">
                      {selectedListing.description}
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedViewing(null)}
                    className="flex-1 h-9 text-xs"
                  >
                    Close
                  </Button>
                  <Button
                    variant="accent"
                    onClick={() => {
                      setSelectedViewing(null);
                      router.push(`/listing/${selectedViewing.listingId}`);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Go to Listing
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EventBlock({
  block,
  onOpenViewing,
}: {
  block: Block;
  onOpenViewing: (v: Viewing) => void;
}) {
  const start = getStart(block);
  const end = getEnd(block);
  const startOffset = hoursFromStart(start);
  const duration = Math.max(0.75, hoursFromStart(end) - startOffset);
  const top = startOffset * HOUR_HEIGHT_PX;
  const height = duration * HOUR_HEIGHT_PX - 4;

  const [timeLabel, setTimeLabel] = useState("");
  useEffect(() => {
    setTimeLabel(`${format(start, "h:mm a")} – ${format(end, "h:mm a")}`);
  }, [start, end]);

  if (block.kind === "viewing") {
    return (
      <motion.button
        layout
        type="button"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        onClick={() => onOpenViewing(block.ev)}
        className="absolute left-1.5 right-1.5 overflow-hidden rounded-md bg-accent px-2 py-1.5 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5"
        style={{ top, height }}
      >
        <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide opacity-90">
          <Building2 className="h-3 w-3" />
          <span>Viewing</span>
        </div>
        <p className="mt-0.5 truncate text-[12.5px] font-medium leading-tight">
          {block.ev.address}
        </p>
        <p suppressHydrationWarning className="mt-0.5 text-[11px] opacity-80 tabular">
          {timeLabel}
        </p>
        <p className="mt-0.5 truncate text-[11px] opacity-80">
          w/ {block.ev.brokerName}
        </p>
      </motion.button>
    );
  }

  return (
    <div
      className="absolute left-1.5 right-1.5 overflow-hidden rounded-md border border-rule bg-surface-raised px-2 py-1.5"
      style={{ top, height }}
    >
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-ink-faint">
        <User className="h-3 w-3" />
        <span>Personal</span>
      </div>
      <p className="mt-0.5 truncate text-[12.5px] font-medium leading-tight text-ink">
        {block.ev.title}
      </p>
      <p suppressHydrationWarning className="mt-0.5 text-[11px] text-ink-faint tabular">
        {timeLabel}
      </p>
    </div>
  );
}

function NowLine() {
  const [topPx, setTopPx] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = now.getHours() + now.getMinutes() / 60;
      if (h < DAY_START_HOUR || h >= DAY_END_HOUR) {
        setTopPx(null);
      } else {
        setTopPx((h - DAY_START_HOUR) * HOUR_HEIGHT_PX);
      }
    };
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, []);
  if (topPx == null) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 flex items-center"
      style={{ top: topPx }}
    >
      <span className="h-2 w-2 -translate-x-1/2 rounded-full bg-accent shadow-sm" />
      <span className="flex-1 border-t border-accent/70" />
    </div>
  );
}

function format12(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${period}`;
}

function hoursFromStart(d: Date): number {
  return d.getHours() + d.getMinutes() / 60 - DAY_START_HOUR;
}

function getStart(b: Block): Date {
  return new Date(b.kind === "viewing" ? b.ev.startTime : b.ev.startTime);
}
function getEnd(b: Block): Date {
  return new Date(b.kind === "viewing" ? b.ev.endTime : b.ev.endTime);
}
function blockKey(b: Block): string {
  return b.kind === "viewing" ? `v-${b.ev.id}` : `p-${b.ev.id}`;
}
