import { toast } from "sonner";
import { FAKE_BROKER_REPLIES } from "./correspondenceConfig";
import { applyCorrespondenceView, fetchCorrespondenceThread } from "./correspondencePoll";
import {
  isCorrespondenceTerminal,
  type CorrespondenceThreadView,
} from "./mapCorrespondence";
import type { Listing } from "./types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function simulateCorrespondenceReply(
  threadId: string,
  body: string,
): Promise<CorrespondenceThreadView> {
  const res = await fetch(
    `/api/correspondence/${encodeURIComponent(threadId)}/simulate-reply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.error || `Simulate reply failed (${res.status})`);
  }
  return payload as CorrespondenceThreadView;
}

/** Play scripted broker replies so Messages UI fills in without Twilio inbound SMS. */
export async function runFakeCorrespondenceScript(
  threadId: string,
  listing?: Listing,
) {
  toast.message("Demo conversation playing", {
    description: "Watch Messages for Javier ↔ broker texts.",
  });

  await sleep(3500);

  for (const reply of FAKE_BROKER_REPLIES) {
    try {
      const view = await simulateCorrespondenceReply(threadId, reply);
      applyCorrespondenceView(view, listing);

      if (isCorrespondenceTerminal(view.status)) {
        if (view.status === "completed") {
          toast.success("Viewing scheduled", {
            description: listing?.address ?? view.listingSummary ?? undefined,
          });
        }
        return;
      }

      await sleep(4500);
    } catch (error) {
      toast.error("Fake reply failed", {
        description: error instanceof Error ? error.message : undefined,
      });
      return;
    }
  }

  try {
    const finalView = await fetchCorrespondenceThread(threadId);
    applyCorrespondenceView(finalView, listing);
  } catch {
    /* best effort */
  }
}
