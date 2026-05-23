let cachedFakeDemo: boolean | null = null;
let cachedDevRoutes: boolean | null = null;

export async function isFakeCorrespondenceDemo(): Promise<boolean> {
  await refreshCorrespondenceConfig();
  return cachedFakeDemo ?? false;
}

/** Dev outreach (Virtual Phone fallback, simulate-reply). */
export async function isCorrespondenceDevMode(): Promise<boolean> {
  await refreshCorrespondenceConfig();
  return cachedDevRoutes ?? false;
}

async function refreshCorrespondenceConfig() {
  if (typeof window === "undefined") return;
  if (process.env.NEXT_PUBLIC_CORRESPONDENCE_FAKE_DEMO === "1") {
    cachedFakeDemo = true;
    cachedDevRoutes = true;
    return;
  }
  if (cachedFakeDemo !== null && cachedDevRoutes !== null) return;

  try {
    const res = await fetch("/api/correspondence/config", { cache: "no-store" });
    if (!res.ok) {
      cachedFakeDemo = false;
      cachedDevRoutes = false;
      return;
    }
    const data = (await res.json()) as { fakeDemo?: boolean; devRoutes?: boolean };
    cachedFakeDemo = Boolean(data.fakeDemo);
    cachedDevRoutes = Boolean(data.devRoutes);
  } catch {
    cachedFakeDemo = false;
    cachedDevRoutes = false;
  }
}

export const FAKE_BROKER_REPLIES = [
  "Hi Javier — yes, the unit is still available. I could do Saturday afternoon for a showing.",
  "Saturday at 2pm works great. Meet at the lobby buzzer 2R.",
] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
