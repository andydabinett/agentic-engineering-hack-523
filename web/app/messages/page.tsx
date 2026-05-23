"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { differenceInDays, differenceInHours, differenceInMinutes, format } from "date-fns";
import { MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageThread } from "@/components/message-thread";
import { useAppStore } from "@/lib/store";
import type { Conversation } from "@/lib/types";
import { brokerInitials, cn } from "@/lib/utils";

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ink-muted">Loading messages…</div>}>
      <MessagesPageContent />
    </Suspense>
  );
}

function MessagesPageContent() {
  const conversations = useAppStore((s) => s.conversations);
  const sorted = useMemo(
    () =>
      conversations
        .slice()
        .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime()),
    [conversations],
  );

  const searchParams = useSearchParams();
  const urlId = searchParams.get("conversation");
  const [activeId, setActiveId] = useState<string | null>(urlId);

  useEffect(() => {
    if (urlId) setActiveId(urlId);
  }, [urlId]);

  useEffect(() => {
    if (!activeId && sorted.length > 0) setActiveId(sorted[0].id);
  }, [activeId, sorted]);

  const active = sorted.find((c) => c.id === activeId) ?? sorted[0] ?? null;

  return (
    <div className="flex h-screen">
      {/* Thread list */}
      <aside className="flex h-screen w-[340px] shrink-0 flex-col border-r border-rule bg-surface">
        <header className="border-b border-rule px-5 pt-6 pb-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            Inbox
          </p>
          <h1 className="mt-1 font-serif text-2xl leading-tight">Messages</h1>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Conversations the agent is running with brokers.
          </p>
        </header>
        <ul className="flex-1 overflow-y-auto py-1">
          {sorted.map((c) => (
            <ThreadRow
              key={c.id}
              conversation={c}
              active={active?.id === c.id}
              onClick={() => setActiveId(c.id)}
            />
          ))}
        </ul>
      </aside>

      {/* Active thread */}
      <section className="flex h-screen min-w-0 flex-1">
        {active ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <MessageThread conversation={active} variant="page" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-8">
            <MessageSquare className="h-6 w-6 text-ink-faint" strokeWidth={1.5} />
            <h2 className="font-serif text-xl leading-tight">No conversations yet</h2>
            <p className="text-[13px] text-ink-muted">
              The agent will start texting brokers as it matches listings.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function ThreadRow({
  conversation,
  active,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  const last = conversation.messages[conversation.messages.length - 1];
  const preview = last?.body ?? "—";
  const [timeLabel, setTimeLabel] = useState("");

  useEffect(() => {
    setTimeLabel(shortRelative(conversation.lastUpdated));
    const id = window.setInterval(
      () => setTimeLabel(shortRelative(conversation.lastUpdated)),
      30_000,
    );
    return () => window.clearInterval(id);
  }, [conversation.lastUpdated]);

  const statusLabel =
    conversation.status === "awaiting"
      ? "Awaiting reply"
      : conversation.status === "scheduled"
        ? "Scheduled"
        : "Complete";
  const statusTone =
    conversation.status === "awaiting"
      ? "bg-signal-amber-soft text-signal-amber"
      : conversation.status === "scheduled"
        ? "bg-signal-purple-soft text-signal-purple"
        : "bg-signal-gray-soft text-signal-gray";

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
          active ? "bg-accent-soft/60" : "hover:bg-surface-raised",
        )}
      >
        <Avatar className="mt-0.5 h-9 w-9 shrink-0">
          <AvatarFallback className="bg-surface-raised text-ink-muted text-[11px] font-medium">
            {brokerInitials(conversation.brokerName)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <p
                className={cn(
                  "truncate text-[13.5px] leading-tight",
                  conversation.unread
                    ? "font-semibold text-ink"
                    : "font-medium text-ink",
                )}
              >
                {conversation.brokerName}
              </p>
              {conversation.unread && (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </div>
            <span
              suppressHydrationWarning
              className="shrink-0 text-[11px] text-ink-faint tabular"
            >
              {timeLabel}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
            {conversation.brokerPhone}
          </p>
          <p
            className={cn(
              "mt-1 line-clamp-1 text-[12.5px] leading-snug",
              conversation.unread ? "text-ink" : "text-ink-muted",
            )}
          >
            {last?.from === "agent" && (
              <span className="text-ink-faint">You: </span>
            )}
            {preview}
          </p>
          <span
            className={cn(
              "mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
              statusTone,
            )}
          >
            {statusLabel}
          </span>
        </div>
      </button>
    </li>
  );
}

function shortRelative(date: Date): string {
  const now = new Date();
  const mins = differenceInMinutes(now, date);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = differenceInHours(now, date);
  if (hours < 24) return `${hours}h`;
  const days = differenceInDays(now, date);
  if (days < 7) return format(date, "EEE");
  return format(date, "MMM d");
}
