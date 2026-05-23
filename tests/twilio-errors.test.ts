import { describe, expect, it } from "vitest";

import { formatTwilioSendError } from "../src/services/sms/twilio.ts";

describe("formatTwilioSendError", () => {
  it("maps daily limit error to actionable message", () => {
    const err = Object.assign(new Error("Account exceeded the 50 daily messages limit"), {
      code: 63038,
      status: 429,
    });
    expect(formatTwilioSendError(err)).toContain("auto-fallback");
  });

  it("passes through generic errors", () => {
    expect(formatTwilioSendError(new Error("network down"))).toBe("network down");
  });
});
