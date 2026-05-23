import { describe, expect, it } from "vitest";

import {
  assertTransition,
  canTransition,
  statusAfterInbound,
  statusAfterOutbound,
} from "../src/services/correspondence/state.ts";

describe("correspondence state machine", () => {
  it("allows initiated to outreach_sent", () => {
    expect(canTransition("initiated", "outreach_sent")).toBe(true);
  });

  it("rejects completed to outreach_sent", () => {
    expect(canTransition("completed", "outreach_sent")).toBe(false);
    expect(() => assertTransition("completed", "outreach_sent")).toThrow();
  });

  it("maps first outbound message to outreach_sent", () => {
    expect(statusAfterOutbound("initiated", true, "Hello")).toBe("outreach_sent");
  });

  it("detects viewing confirmation in inbound SMS", () => {
    expect(statusAfterInbound("Yes, tomorrow at 2pm works")).toBe("viewing_confirmed");
  });
});
