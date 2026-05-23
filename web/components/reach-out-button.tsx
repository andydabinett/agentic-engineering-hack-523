"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isFakeCorrespondenceDemo } from "@/lib/correspondenceConfig";
import {
  handleCorrespondenceStarted,
  startCorrespondenceForListing,
} from "@/lib/correspondencePoll";
import { isDemoMode } from "@/lib/hydrate";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReachOutButtonProps {
  listing: Listing;
  className?: string;
  size?: "sm" | "default";
}

export function ReachOutButton({
  listing,
  className,
  size = "sm",
}: ReachOutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [fakeDemo, setFakeDemo] = useState(false);

  useEffect(() => {
    void isFakeCorrespondenceDemo().then(setFakeDemo);
  }, []);

  if (isDemoMode() || listing.status !== "matched") {
    return null;
  }

  if (!fakeDemo && !listing.brokerPhone?.trim()) {
    return null;
  }

  const onClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (loading) return;

    setLoading(true);
    try {
      const view = await startCorrespondenceForListing(listing.id);
      handleCorrespondenceStarted(
        {
          ok: true,
          fakeDemo: view.fakeDemo ?? fakeDemo,
          threadId: view.threadId,
          listingId: view.listingId,
          status: view.status,
          brokerName: listing.brokerName,
          address: listing.address,
          messages: view.messages,
        },
        listing,
      );
    } catch (error) {
      toast.error("Could not start outreach", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn("shrink-0", className)}
      disabled={loading}
      onClick={onClick}
    >
      <MessageSquare className="h-3.5 w-3.5" />
      {loading ? "Texting…" : fakeDemo ? "Demo reach out" : "Reach out"}
    </Button>
  );
}
