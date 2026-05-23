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
