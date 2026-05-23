export interface SmsSendResult {
  sid: string;
}

export interface SmsProvider {
  send(to: string, body: string): Promise<SmsSendResult>;
}

export class FakeSmsProvider implements SmsProvider {
  readonly sent: Array<{ to: string; body: string; sid: string }> = [];
  failNext = false;

  async send(to: string, body: string): Promise<SmsSendResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("Fake SMS send failure");
    }
    const sid = `SM_fake_${this.sent.length + 1}`;
    this.sent.push({ to, body, sid });
    return { sid };
  }
}

/** Dev: try Twilio once; on rate-limit errors permanently switch to FakeSmsProvider. */
export class TwilioWithFakeFallbackSmsProvider implements SmsProvider {
  private readonly fake = new FakeSmsProvider();
  private usingFake = false;

  constructor(
    private readonly twilio: SmsProvider,
    private readonly onFallback?: (error: unknown) => void,
  ) {}

  async send(to: string, body: string): Promise<SmsSendResult> {
    if (this.usingFake) {
      return this.fake.send(to, body);
    }
    try {
      return await this.twilio.send(to, body);
    } catch (error) {
      const { isTwilioOverloadError } = await import("./twilio.ts");
      if (!isTwilioOverloadError(error)) {
        throw error;
      }
      this.usingFake = true;
      this.onFallback?.(error);
      return this.fake.send(to, body);
    }
  }
}
