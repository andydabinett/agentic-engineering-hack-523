"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, MessageCircle } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import type { Conversation, Message } from "@/lib/types";
import { brokerInitials, cn } from "@/lib/utils";
import { stripHtml } from "@/lib/stripHtml";

interface MessageThreadProps {
  conversation: Conversation;
  variant?: "page" | "embedded";
  /** Optional CTA → listing detail (shown in header for /messages page) */
  showListingLink?: boolean;
}

export function MessageThread({
  conversation,
  variant = "page",
  showListingLink = true,
}: MessageThreadProps) {
  const grouped = useMemo(() => groupBySeparator(conversation.messages), [
    conversation.messages,
  ]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [conversation.messages]);

  const lastAgentIdx = (() => {
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      if (conversation.messages[i].from === "agent") return i;
    }
    return -1;
  })();
  const lastAgentMessage =
    lastAgentIdx >= 0 ? conversation.messages[lastAgentIdx] : null;
  const lastAgentReceipt = lastAgentMessage?.receipt ?? "delivered";

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden border-rule bg-surface",
        variant === "page" ? "border-l" : "rounded-xl border",
      )}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-accent-soft text-accent-deep text-[11px] font-medium">
              {brokerInitials(conversation.brokerName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-semibold text-ink leading-tight">
              {conversation.brokerName}
            </p>
            <p className="font-mono text-[11.5px] text-ink-faint leading-tight">
              {conversation.brokerPhone}
            </p>
          </div>
        </div>
        {showListingLink && (
          <Link
            href={`/listing/${conversation.listingId}`}
            className="hidden items-center gap-1 text-[12.5px] text-ink-muted hover:text-ink sm:inline-flex"
          >
            View listing
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </header>

      {/* Messages */}
      <div
        ref={scrollerRef}
        className="flex-1 min-h-0 overflow-y-auto px-5 py-6"
        style={{ background: "color-mix(in oklch, hsl(var(--canvas)) 75%, transparent)" }}
      >
        <ul className="flex flex-col gap-1.5">
          {grouped.map((node, i) => {
            if (node.kind === "separator") {
              return (
                <li
                  key={`sep-${i}`}
                  className="my-2 flex items-center justify-center"
                >
                  <span suppressHydrationWarning className="text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
                    <DayLabel date={node.date} />
                  </span>
                </li>
              );
            }
            const m = node.message;
            const isAgent = m.from === "agent";
            const isLastAgent = lastAgentMessage?.id === m.id;
            return (
              <li
                key={m.id}
                className={cn("flex", isAgent ? "justify-end" : "justify-start")}
              >
                <div className="max-w-[78%] flex flex-col">
                  <div
                    className={cn(
                      "px-3.5 py-2 text-[14.5px] leading-snug shadow-[0_1px_0_rgba(0,0,0,0.02)]",
                      isAgent
                        ? "rounded-2xl rounded-br-md bg-accent text-white"
                        : "rounded-2xl rounded-bl-md bg-surface-raised text-ink",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{stripHtml(m.body)}</p>
                  </div>
                  {isAgent && isLastAgent && (
                    <span suppressHydrationWarning className="mt-1 self-end text-[10.5px] text-ink-faint">
                      {lastAgentReceipt === "read" ? "Read" : "Delivered"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Disabled input */}
      <div className="border-t border-rule bg-canvas px-4 py-3">
        <div className="flex items-end gap-2 rounded-md border border-rule bg-surface px-3 py-2 opacity-90">
          <MessageCircle className="h-4 w-4 text-ink-faint shrink-0" />
          <Textarea
            disabled
            placeholder="Agent replies automatically"
            rows={1}
            className="border-0 bg-transparent px-0 py-1 text-[14px] disabled:opacity-100"
            style={{ minHeight: 24 }}
          />
        </div>
      </div>
    </div>
  );
}

type GroupedNode =
  | { kind: "separator"; date: Date }
  | { kind: "message"; message: Message };

function groupBySeparator(messages: Message[]): GroupedNode[] {
  const out: GroupedNode[] = [];
  let prev: Date | null = null;
  for (const m of messages) {
    if (
      !prev ||
      !isSameDay(prev, m.timestamp) ||
      m.timestamp.getTime() - prev.getTime() > 5 * 60_000
    ) {
      out.push({ kind: "separator", date: m.timestamp });
    }
    out.push({ kind: "message", message: m });
    prev = m.timestamp;
  }
  return out;
}

function DayLabel({ date }: { date: Date }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(format(date, "EEE h:mm a"));
  }, [date]);
  return <>{label}</>;
}
