/** Extract agent/contact fields from listing page text. */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const TEL_URI_RE = /tel:([+\d().\s-]{10,})/gi;
const PHONE_RE =
  /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g;

const AGENT_LABEL_RE =
  /(?:listed by|contact|agent|broker|posted by|managed by|leasing)[:\s]+([^\n|]{3,80})/gi;
const AGENCY_RE =
  /(?:brokerage|agency|company|realty|real estate|property management)[:\s]+([^\n|]{3,80})/gi;

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

function formatPhone(digits) {
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const NYC_AREA_CODES = new Set([
  '212', '332', '347', '516', '518', '585', '607', '631', '646', '680',
  '716', '718', '838', '845', '914', '917', '929', '934',
]);

function isPlausiblePhone(digits, { nycOnly = true } = {}) {
  if (digits.length !== 10) return false;
  if (digits.startsWith('000') || digits.startsWith('555')) return false;
  const area = digits.slice(0, 3);
  if (nycOnly && !NYC_AREA_CODES.has(area)) return false;
  const n = Number(digits);
  if (n >= 2000000000 && n <= 2030000000) return false;
  return true;
}

function stripUrls(text) {
  return text.replace(/https?:\/\/[^\s)]+/gi, ' ');
}

function digitsInListingUrl(digits, listingUrl) {
  if (!listingUrl) return false;
  const id = listingUrl.match(/\/(\d{8,})\.html/i);
  if (!id) return false;
  const raw = id[1];
  return raw.includes(digits) || digits.includes(raw.slice(-10));
}

export function extractPhones(text, { listingUrl } = {}) {
  const found = new Set();
  const body = stripUrls(text);

  for (const match of body.matchAll(TEL_URI_RE)) {
    const digits = normalizePhone(match[1]);
    if (digits && isPlausiblePhone(digits, { nycOnly: true }) && !digitsInListingUrl(digits, listingUrl)) {
      found.add(formatPhone(digits));
    }
  }

  for (const match of body.matchAll(PHONE_RE)) {
    const digits = normalizePhone(match[0]);
    if (digits && isPlausiblePhone(digits, { nycOnly: true }) && !digitsInListingUrl(digits, listingUrl)) {
      found.add(formatPhone(digits));
    }
  }

  return [...found];
}

export function extractEmails(text) {
  const emails = new Set();
  for (const match of text.matchAll(EMAIL_RE)) {
    const email = match[0].toLowerCase();
    if (!email.endsWith('.png') && !email.endsWith('.jpg')) {
      emails.add(email);
    }
  }
  return [...emails];
}

function firstLabelMatch(re, text) {
  const m = re.exec(text);
  re.lastIndex = 0;
  if (!m) return null;
  return m[1].replace(/\s+/g, ' ').trim().slice(0, 120) || null;
}

function cleanField(value) {
  if (!value) return null;
  const cleaned = value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length >= 2 ? cleaned.slice(0, 120) : null;
}

export function parseContacts(text, source, { listingUrl } = {}) {
  const phones = extractPhones(text, { listingUrl });
  const emails = extractEmails(stripUrls(text));

  let agentName = firstLabelMatch(AGENT_LABEL_RE, text);
  let agencyName = firstLabelMatch(AGENCY_RE, text);

  if (source === 'streeteasy' && !agentName) {
    const listedBy = text.match(/listed by\s+([^\n]+)/i);
    if (listedBy) agentName = listedBy[1].trim().slice(0, 120);
  }

  if (source === 'craigslist' && !agentName) {
    const reply = text.match(/reply to:\s*([^\n]+)/i);
    if (reply) agentName = reply[1].trim().slice(0, 120);
  }

  return {
    agentName: cleanField(agentName),
    agencyName: cleanField(agencyName),
    agentEmail: emails[0] ?? null,
    agentPhone: phones[0] ?? null,
    allPhones: phones,
    allEmails: emails,
  };
}
