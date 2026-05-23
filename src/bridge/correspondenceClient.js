import { normalizePhone } from "./normalizePhone.js";

const DEFAULT_USER_ID = "web-user";

export function correspondenceApiUrl() {
  return (process.env.CORRESPONDENCE_API_URL || "http://localhost:3001").replace(
    /\/$/,
    "",
  );
}

export function twilioConfiguredForCorrespondence() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_PHONE_NUMBER?.trim(),
  );
}

export function correspondenceFakeDemoEnabled() {
  return process.env.CORRESPONDENCE_FAKE_DEMO === "1";
}

export function demoListerPhone() {
  return process.env.DEMO_LISTER_PHONE || "+18777804236";
}

export function correspondenceDevEnabled() {
  return (
    process.env.CORRESPONDENCE_DEV === "1" || process.env.CORRESPONDENCE_FAKE_DEMO === "1"
  );
}

/** Use Virtual Phone / demo lister when fake demo or local dev outreach. */
export function useDemoListerPhoneFallback() {
  return correspondenceFakeDemoEnabled() || correspondenceDevEnabled();
}

export function canStartCorrespondence() {
  return twilioConfiguredForCorrespondence() || correspondenceFakeDemoEnabled();
}

/**
 * @param {{
 *   listingId: string;
 *   listerPhone: string;
 *   listerName?: string;
 *   userId?: string;
 *   listingSummary?: string;
 * }} input
 */
export async function startCorrespondence(input) {
  const base = correspondenceApiUrl();
  const listerPhone = normalizePhone(input.listerPhone);
  if (!listerPhone) {
    throw new Error("Lister phone is required to start correspondence.");
  }

  const body = {
    listingId: input.listingId,
    listerPhone,
    listerName: input.listerName,
    userId: input.userId || DEFAULT_USER_ID,
    listingSummary: input.listingSummary,
  };

  const response = await fetch(`${base}/correspondence/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text || `HTTP ${response.status}` };
  }

  if (!response.ok) {
    throw new Error(payload.error || `Correspondence start failed (${response.status})`);
  }

  return payload;
}

/**
 * @param {string} threadId
 */
export async function getCorrespondenceThread(threadId) {
  const base = correspondenceApiUrl();
  const response = await fetch(`${base}/correspondence/${encodeURIComponent(threadId)}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Correspondence fetch failed (${response.status})`);
  }
  return payload;
}

/**
 * @param {{ listingId?: string; userId?: string }} filters
 */
export async function listCorrespondenceThreads(filters = {}) {
  const base = correspondenceApiUrl();
  const params = new URLSearchParams();
  if (filters.listingId) params.set("listingId", filters.listingId);
  params.set("userId", filters.userId || DEFAULT_USER_ID);
  const response = await fetch(`${base}/correspondence?${params}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Correspondence list failed (${response.status})`);
  }
  return payload;
}

export function buildListingSummary(listing) {
  if (!listing) return undefined;
  const beds = listing.beds === 0 ? "Studio" : `${listing.beds}BR`;
  const price = listing.pricePerMonth
    ? `$${listing.pricePerMonth.toLocaleString()}/mo`
    : "";
  const parts = [listing.address, listing.neighborhood, beds, price].filter(Boolean);
  return parts.join(" · ");
}

/**
 * @param {string} threadId
 * @param {string} body
 */
export async function simulateCorrespondenceReply(threadId, body) {
  const base = correspondenceApiUrl();
  const response = await fetch(
    `${base}/correspondence/${encodeURIComponent(threadId)}/simulate-reply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text || `HTTP ${response.status}` };
  }

  if (!response.ok) {
    throw new Error(payload.error || `Simulate reply failed (${response.status})`);
  }

  return payload;
}
