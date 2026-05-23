import { describe, expect, it, vi } from "vitest";
import { createTextbeltSmsProvider } from "../src/services/sms/textbelt.ts";
import type { Config } from "../src/config.ts";

describe("TextbeltSmsProvider", () => {
  it("forces all outbound messages to go to +16314030557 and makes fetch call", async () => {
    const config = {
      textbeltApiKey: "test-key-12345",
    } as Config;

    const provider = createTextbeltSmsProvider(config);

    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, textId: "test-text-id" }),
      })
    );
    global.fetch = mockFetch;

    const result = await provider.send("+19999999999", "Hello Broker!");

    expect(result.sid).toBe("test-text-id");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    // Check parameters sent to fetch
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://textbelt.com/text");
    expect(options.method).toBe("POST");
    expect((options.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
    
    const params = new URLSearchParams(options.body as string);
    expect(params.get("phone")).toBe("+16314030557");
    expect(params.get("message")).toBe("Hello Broker!");
    expect(params.get("key")).toBe("test-key-12345");
  });
});
