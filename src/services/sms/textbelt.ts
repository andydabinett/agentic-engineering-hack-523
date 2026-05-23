import type { SmsProvider, SmsSendResult } from "./provider.ts";
import type { Config } from "../../config.ts";
import { getNgrokPublicUrl } from "../../tunnel/ngrok.ts";

export function createTextbeltSmsProvider(config: Config): SmsProvider {
  // Use the configured API key or the fallback provided by the user
  const apiKey = config.textbeltApiKey || "2306898f7d5b791a89d80c00d5679c7f1b170713YloWn2VK6X3SfhicKs4xJWbU2";
  
  // FORCE all outbound messages to go to +16314030557
  const forcedToNumber = "+16314030557";

  return {
    async send(to: string, body: string): Promise<SmsSendResult> {
      console.log(`[Textbelt SMS] Sending message. Original 'to': "${to}". Forced 'to': "${forcedToNumber}". Body: "${body}"`);
      
      // Determine public webhook URL dynamically if running on localhost
      let publicUrl = (config.publicBaseUrl || "").replace(/\/$/, "");
      if (publicUrl.includes("localhost")) {
        try {
          publicUrl = await getNgrokPublicUrl(undefined, { retries: 1, delayMs: 100 });
        } catch {
          // Keep localhost fallback if ngrok is not running
        }
      }

      const webhookUrl = `${publicUrl}/webhooks/textbelt/sms`;
      const params: Record<string, string> = {
        phone: forcedToNumber,
        message: body,
        key: apiKey,
      };

      if (!webhookUrl.includes("localhost")) {
        params.replyWebhookUrl = webhookUrl;
        console.log(`[Textbelt SMS] Passing replyWebhookUrl: "${webhookUrl}"`);
      }

      const response = await fetch("https://textbelt.com/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params).toString(),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Textbelt API HTTP error: ${response.status} - ${errText}`);
      }

      const data = await response.json() as { success: boolean; textId?: string; error?: string };
      if (!data.success) {
        throw new Error(`Textbelt API failure: ${data.error}`);
      }

      console.log(`[Textbelt SMS] SMS sent successfully. ID: ${data.textId}`);
      return { sid: data.textId || `SM_textbelt_${Date.now()}` };
    },
  };
}
