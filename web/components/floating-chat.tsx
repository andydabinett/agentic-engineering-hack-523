"use client";

import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChatPanel } from "@/components/chat-panel";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Persistent bottom-right chat button. Hidden on /onboarding (chat is
 * already the primary surface there). Clicking opens a right-side drawer
 * that hosts the same ChatPanel.
 */
export function FloatingChat() {
  const pathname = usePathname();
  const open = useAppStore((s) => s.chatOpen);
  const setChatOpen = useAppStore((s) => s.setChatOpen);
  const hasNotification = useAppStore((s) => s.hasChatNotification);

  if (pathname === "/onboarding" || pathname === "/") return null;

  return (
    <Sheet open={open} onOpenChange={setChatOpen}>
      <button
        type="button"
        onClick={() => setChatOpen(true)}
        aria-label="Open agent chat"
        className={cn(
          "group fixed bottom-6 right-6 z-30 flex h-13 w-13 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition-transform hover:-translate-y-0.5 hover:bg-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        )}
        style={{ height: 56, width: 56 }}
      >
        <Sparkles className="h-5 w-5" strokeWidth={1.8} />
        {hasNotification && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-green opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-signal-green ring-2 ring-canvas" />
          </span>
        )}
      </button>

      <SheetContent side="right" className="w-full max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="border-b border-rule px-5 pt-5 pb-4">
          <SheetTitle className="font-serif text-lg leading-tight">
            Talk to your agent
          </SheetTitle>
          <SheetDescription>
            Refine criteria, ask about a listing, or get a status update.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0">
          <ChatPanel variant="drawer" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
