"use client";

import { useEffect, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";

interface RelativeTimeProps {
  date: Date;
  /** addSuffix=true → "11 minutes ago"; false → "11 minutes" */
  addSuffix?: boolean;
  className?: string;
  fallback?: string;
}

/**
 * Renders a relative timestamp ("11 min ago") only on the client to
 * avoid SSR/hydration mismatches caused by clock drift.
 */
export function RelativeTime({
  date,
  addSuffix = true,
  className,
  fallback = "",
}: RelativeTimeProps) {
  const [label, setLabel] = useState<string>(fallback);

  useEffect(() => {
    const update = () => setLabel(formatDistanceToNow(date, { addSuffix }));
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, [date, addSuffix]);

  return (
    <span suppressHydrationWarning className={className}>
      {label}
    </span>
  );
}

/**
 * Renders an absolute time formatted with date-fns, client-only.
 */
export function ClientTime({
  date,
  pattern,
  className,
}: {
  date: Date;
  pattern: string;
  className?: string;
}) {
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    setLabel(format(date, pattern));
  }, [date, pattern]);

  return (
    <span suppressHydrationWarning className={className}>
      {label}
    </span>
  );
}
