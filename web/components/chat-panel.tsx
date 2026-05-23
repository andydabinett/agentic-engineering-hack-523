"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { Building2, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ClientTime } from "@/components/client-time";
import { pollUntilScrapeDone } from "@/lib/scrapePoll";
import { handleCorrespondenceStarted } from "@/lib/correspondencePoll";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const SEED_MESSAGE: UIMessage = {
  id: "seed-greeting",
  role: "assistant",
  parts: [
    {
      type: "text",
      state: "done",
      text:
        "Hey — I'm here to help you find an apartment in NYC. Tell me what you're looking for. Neighborhood? Budget? Anything you absolutely need or absolutely can't deal with?",
    },
  ],
};

type Variant = "page" | "drawer";

interface ChatPanelProps {
  variant?: Variant;
}

export function ChatPanel({ variant = "page" }: ChatPanelProps) {
  const chatSessionIdRef = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `chat-${Date.now()}`,
  );
  const criteria = useAppStore((s) => s.criteria);
  const applyCriteriaUpdate = useAppStore((s) => s.applyCriteriaUpdate);
  const markReadyToSearch = useAppStore((s) => s.markReadyToSearch);
  const setListings = useAppStore((s) => s.setListings);
  const setStatusCounts = useAppStore((s) => s.setStatusCounts);

  const { messages, sendMessage, status } = useChat({
    messages: [SEED_MESSAGE],
    // @ts-ignore
    body: { criteria, chatSessionId: chatSessionIdRef.current },
    onData: (part) => {
      // Custom data parts: data-update-criteria / data-ready-to-search
      if (part.type === "data-update-criteria") {
        const { field, value } = (part as { data: { field: string; value: string | number } }).data;
        applyCriteriaUpdate(field as never, value);
        return;
      }
      if (part.type === "data-ready-to-search") {
        markReadyToSearch();
        return;
      }
      if (part.type === "data-correspondence-started") {
        const data = (part as { data: Record<string, unknown> }).data;
        const listingId = String(data.listingId ?? "");
        const listing = useAppStore.getState().listings.find((l) => l.id === listingId);
        handleCorrespondenceStarted(
          data as Parameters<typeof handleCorrespondenceStarted>[0],
          listing,
        );
        return;
      }
    },
    onToolCall: ({ toolCall }) => {
      // Future-proof: also accept real tool calls under these names
      if (toolCall.toolName === "update_criteria") {
        const { field, value } = toolCall.input as { field: string; value: string | number };
        applyCriteriaUpdate(field as never, value);
      } else if (toolCall.toolName === "ready_to_search") {
        markReadyToSearch();
      } else if (toolCall.toolName === "scrape_listings") {
        const prev = useAppStore.getState().listings;
        pollUntilScrapeDone((listings, stats) => {
          const newIds = listings
            .filter((l) => !prev.some((p) => p.id === l.id))
            .map((l) => l.id);
          if (listings.length) {
            useAppStore.getState().mergeLiveListings(listings, newIds);
          }
          if (stats) {
            setStatusCounts({
              listingsMonitored: stats.listingsMonitored,
              matches: stats.matches,
              brokersTexted: stats.brokersTexted,
              viewingsScheduled: stats.viewingsScheduled,
            });
          }
        });
      }
    },
  });

  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isThinking = status === "submitted";

  // Stamp messages with arrival time (client-only) for the hover tooltip
  const [stamps, setStamps] = useState<Record<string, Date>>(() => ({
    [SEED_MESSAGE.id]: new Date(),
  }));
  useEffect(() => {
    setStamps((prev) => {
      const next = { ...prev };
      for (const m of messages) {
        if (!next[m.id]) next[m.id] = new Date();
      }
      return next;
    });
  }, [messages]);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  const canSend = input.trim().length > 0 && status !== "submitted" && status !== "streaming";

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    sendMessage({ text });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollerRef}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto px-5 py-6",
          variant === "drawer" && "px-5",
        )}
      >
        <ul className="flex flex-col gap-4">
          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} timestamp={stamps[m.id]} />
          ))}
          {isThinking && <TypingBubble />}
        </ul>
      </div>

      <div className="border-t border-rule bg-canvas px-4 py-3">
        <div className="flex items-end gap-2 rounded-md border border-rule bg-surface px-3 py-2 transition-colors focus-within:border-rule-strong">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell the agent what you want…"
            rows={1}
            className="border-0 bg-transparent px-0 py-1 text-[14.5px] leading-snug focus-visible:border-0 focus-visible:outline-none"
            style={{ minHeight: 28 }}
          />
          <Button
            type="button"
            size="icon"
            variant="accent"
            disabled={!canSend}
            onClick={submit}
            className="h-8 w-8 shrink-0 rounded-md"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-ink-faint">
          <span>
            <kbd className="font-mono">Enter</kbd> to send ·{" "}
            <kbd className="font-mono">Shift</kbd>+<kbd className="font-mono">Enter</kbd> for newline
          </span>
          <span className="opacity-70">{status === "streaming" ? "Agent is typing…" : "End-to-end encrypted"}</span>
        </div>
      </div>
    </div>
  );
}

function textFromMessage(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string; state?: "streaming" | "done" } =>
      p.type === "text" && typeof (p as { text?: unknown }).text === "string",
    )
    .map((p) => p.text)
    .join("");
}

function ChatBubble({
  message,
  timestamp,
}: {
  message: UIMessage;
  timestamp?: Date;
}) {
  const text = textFromMessage(message);
  if (!text && message.role === "assistant") return null;

  const isAgent = message.role === "assistant";

  return (
    <li className={cn("group flex gap-2.5", isAgent ? "justify-start" : "justify-end")}>
      {isAgent && (
        <Avatar className="mt-0.5 h-7 w-7 shrink-0 rounded-md">
          <AvatarFallback className="rounded-md bg-ink text-canvas">
            <Building2 className="h-3.5 w-3.5" strokeWidth={2} />
          </AvatarFallback>
        </Avatar>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "max-w-[78%] rounded-2xl px-3.5 py-2 text-[14.5px] leading-snug shadow-sm",
              isAgent
                ? "bg-surface-raised text-ink rounded-tl-md"
                : "bg-accent text-white rounded-tr-md",
            )}
          >
            <p className="whitespace-pre-wrap break-words">{text}</p>
          </div>
        </TooltipTrigger>
        {timestamp && (
          <TooltipContent side={isAgent ? "right" : "left"} sideOffset={6}>
            <ClientTime date={timestamp} pattern="EEE h:mm a" />
          </TooltipContent>
        )}
      </Tooltip>
    </li>
  );
}

function TypingBubble() {
  return (
    <li className="flex justify-start gap-2.5">
      <Avatar className="mt-0.5 h-7 w-7 shrink-0 rounded-md">
        <AvatarFallback className="rounded-md bg-ink text-canvas">
          <Building2 className="h-3.5 w-3.5" strokeWidth={2} />
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-surface-raised px-4 py-3">
        <Dot />
        <Dot delay={150} />
        <Dot delay={300} />
      </div>
    </li>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="block h-1.5 w-1.5 rounded-full bg-ink-muted"
      style={{
        animation: "typing-dot 1.2s ease-in-out infinite",
        animationDelay: `${delay}ms`,
      }}
    />
  );
}
