"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

function useCountUp(target: number, durationMs = 1100) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const toRef = useRef(target);

  useEffect(() => {
    fromRef.current = value;
    toRef.current = target;
    startRef.current = null;

    let raf = 0;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(fromRef.current + (toRef.current - fromRef.current) * eased);
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}

export function DashboardStatusBar() {
  const counts = useAppStore((s) => s.statusCounts);
  const listings = useCountUp(counts.listingsMonitored);
  const matches = useCountUp(counts.matches);
  const brokers = useCountUp(counts.brokersTexted);
  const scheduled = useCountUp(counts.viewingsScheduled);

  return (
    <div className="sticky top-0 z-20 border-b border-rule bg-canvas/85 px-8 py-4 backdrop-blur-md">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-[13.5px]">
        <StatBlock label="Monitoring" n={listings} suffix="listings" pulse />
        <Sep />
        <StatBlock label={null} n={matches} suffix="matches found" tone="accent" />
        <Sep />
        <StatBlock label={null} n={brokers} suffix="brokers texted" />
        <Sep />
        <StatBlock label={null} n={scheduled} suffix="viewings scheduled" />
        <div className="ml-auto hidden sm:flex items-center gap-2 text-[12px] text-ink-faint">
          <span className="relative inline-flex">
            <span className="absolute inset-0 animate-ping rounded-full bg-signal-green/60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-signal-green" />
          </span>
          Live
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  n,
  suffix,
  tone,
  pulse,
}: {
  label: string | null;
  n: number;
  suffix: string;
  tone?: "accent";
  pulse?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5 tabular">
      {label && (
        <span className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          {label}
        </span>
      )}
      <span
        className={cn(
          "font-serif text-[18px] leading-none tracking-tight text-ink",
          tone === "accent" && "text-accent-deep",
          pulse && "animate-pulse-soft",
        )}
      >
        {n}
      </span>
      <span className="text-ink-muted">{suffix}</span>
    </span>
  );
}

function Sep() {
  return <span className="text-ink-faint">·</span>;
}
