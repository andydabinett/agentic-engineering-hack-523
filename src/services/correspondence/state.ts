export const CORRESPONDENCE_STATUSES = [
  "initiated",
  "outreach_sent",
  "awaiting_lister_reply",
  "negotiating_time",
  "viewing_proposed",
  "viewing_confirmed",
  "calendar_event_created",
  "completed",
  "failed",
  "needs_user_input",
] as const;

export type CorrespondenceStatus = (typeof CORRESPONDENCE_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<
  CorrespondenceStatus,
  readonly CorrespondenceStatus[]
> = {
  initiated: ["outreach_sent", "failed"],
  outreach_sent: ["awaiting_lister_reply", "negotiating_time", "failed"],
  awaiting_lister_reply: ["negotiating_time", "viewing_proposed", "viewing_confirmed", "failed"],
  negotiating_time: ["viewing_proposed", "viewing_confirmed", "failed"],
  viewing_proposed: ["viewing_confirmed", "negotiating_time", "failed"],
  viewing_confirmed: ["calendar_event_created", "completed", "failed"],
  calendar_event_created: ["completed", "failed"],
  completed: [],
  failed: [],
  needs_user_input: ["negotiating_time", "viewing_proposed", "failed"],
};

export function canTransition(
  from: CorrespondenceStatus,
  to: CorrespondenceStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: CorrespondenceStatus,
  to: CorrespondenceStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid status transition: ${from} -> ${to}`);
  }
}

export function statusAfterOutbound(
  current: CorrespondenceStatus,
  isFirstMessage: boolean,
  messageBody: string,
): CorrespondenceStatus {
  if (
    current === "viewing_confirmed" ||
    current === "calendar_event_created" ||
    current === "completed" ||
    current === "failed"
  ) {
    return current;
  }
  if (isFirstMessage) {
    return "outreach_sent";
  }
  const lower = messageBody.toLowerCase();
  if (
    lower.includes("?") &&
    (lower.includes("time") ||
      lower.includes("view") ||
      lower.includes("tour") ||
      lower.includes("available"))
  ) {
    return "viewing_proposed";
  }
  if (current === "outreach_sent" || current === "awaiting_lister_reply") {
    return "negotiating_time";
  }
  return current;
}

export function statusAfterInbound(body: string): CorrespondenceStatus {
  const lower = body.toLowerCase();
  const confirms =
    /\b(yes|yeah|yep|sure|works|confirm|sounds good|ok|okay)\b/.test(lower);
  const hasTime =
    /\b(\d{1,2}(:\d{2})?\s?(am|pm)|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
      lower,
    );

  if (confirms && hasTime) {
    return "viewing_confirmed";
  }
  if (hasTime) {
    return "negotiating_time";
  }
  return "negotiating_time";
}
