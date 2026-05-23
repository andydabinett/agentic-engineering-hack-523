let cachedFakeDemo: boolean | null = null;

export async function isFakeCorrespondenceDemo(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_CORRESPONDENCE_FAKE_DEMO === "1") return true;
  if (cachedFakeDemo !== null) return cachedFakeDemo;

  try {
    const res = await fetch("/api/correspondence/config", { cache: "no-store" });
    if (!res.ok) {
      cachedFakeDemo = false;
      return false;
    }
    const data = (await res.json()) as { fakeDemo?: boolean };
    cachedFakeDemo = Boolean(data.fakeDemo);
    return cachedFakeDemo;
  } catch {
    cachedFakeDemo = false;
    return false;
  }
}

export const FAKE_BROKER_REPLIES = [
  "Hi Javier — yes, the unit is still available. I could do Saturday afternoon for a showing.",
  "Saturday at 2pm works great. Meet at the lobby buzzer 2R.",
] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
