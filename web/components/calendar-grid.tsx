"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  format,
  isSameDay,
  isToday,
  startOfWeek,
} from "date-fns";
import { motion } from "framer-motion";
import { Building2, User } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { PersonalEvent, Viewing } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 21; // 9pm exclusive end
const HOUR_HEIGHT_PX = 64;
const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR;

type Block =
  | { kind: "viewing"; ev: Viewing }
  | { kind: "personal"; ev: PersonalEvent };

export function CalendarGrid() {
  const router = useRouter();
  const viewings = useAppStore((s) => s.viewings);
  const personal = useAppStore((s) => s.personalEvents);

  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const hours = useMemo(
    () => Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START_HOUR + i),
    [],
  );

  const blocksByDay = useMemo<Block[][]>(() => {
    return days.map((d) => {
      const dayBlocks: Block[] = [];
      for (const v of viewings) {
        if (isSameDay(v.startTime, d)) dayBlocks.push({ kind: "viewing", ev: v });
      }
      for (const p of personal) {
        if (isSameDay(p.startTime, d)) dayBlocks.push({ kind: "personal", ev: p });
      }
      return dayBlocks.sort((a, b) =>
        getStart(a).getTime() - getStart(b).getTime(),
      );
    });
  }, [days, personal, viewings]);

  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-surface">
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
                  onOpen={(id) => router.push(`/listing/${id}`)}
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
  );
}

function EventBlock({
  block,
  onOpen,
}: {
  block: Block;
  onOpen: (listingId: string) => void;
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
        onClick={() => onOpen(block.ev.listingId)}
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
  return b.kind === "viewing" ? b.ev.startTime : b.ev.startTime;
}
function getEnd(b: Block): Date {
  return b.kind === "viewing" ? b.ev.endTime : b.ev.endTime;
}
function blockKey(b: Block): string {
  return b.kind === "viewing" ? `v-${b.ev.id}` : `p-${b.ev.id}`;
}
