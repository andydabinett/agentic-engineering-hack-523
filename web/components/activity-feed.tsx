"use client";

import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import {
  CalendarCheck2,
  FileText,
  MailOpen,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { ActivityEntry } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const ICONS = {
  text: MessageSquare,
  reply: MailOpen,
  booked: CalendarCheck2,
  document: FileText,
  match: Sparkles,
} as const;

export function ActivityFeed() {
  const entries = useAppStore((s) => s.activityFeed);

  return (
    <aside className="sticky top-6 flex h-[calc(100vh-3rem)] w-[320px] shrink-0 flex-col overflow-hidden rounded-xl border border-rule bg-surface">
      <header className="border-b border-rule px-5 pt-5 pb-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">
          Live feed
        </p>
        <h2 className="mt-1 font-serif text-xl leading-tight">What the agent is doing</h2>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <ol className="relative flex flex-col gap-5">
          <span
            aria-hidden
            className="absolute left-[10px] top-1 bottom-1 w-px bg-rule"
          />
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <FeedItem key={entry.id} entry={entry} />
            ))}
          </AnimatePresence>
        </ol>
      </div>
    </aside>
  );
}

function FeedItem({ entry }: { entry: ActivityEntry }) {
  const Icon = ICONS[entry.icon];
  const [time, setTime] = useState("");
  useEffect(() => {
    setTime(format(entry.timestamp, "h:mm a"));
  }, [entry.timestamp]);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative pl-7"
    >
      <span
        className={cn(
          "absolute left-0 top-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full",
          entry.icon === "match"
            ? "bg-signal-green-soft text-signal-green"
            : entry.icon === "booked"
              ? "bg-signal-purple-soft text-signal-purple"
              : entry.icon === "reply"
                ? "bg-signal-amber-soft text-signal-amber"
                : entry.icon === "document"
                  ? "bg-accent-soft text-accent-deep"
                  : "bg-signal-blue-soft text-signal-blue",
        )}
      >
        <Icon className="h-3 w-3" strokeWidth={1.8} />
      </span>
      <p className="text-[13.5px] leading-snug text-ink">{entry.body}</p>
      <p suppressHydrationWarning className="mt-0.5 text-[11px] text-ink-faint tabular">
        {time}
      </p>
    </motion.li>
  );
}
