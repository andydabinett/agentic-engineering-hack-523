/**
 * Canonical listing URLs / keys so the same post does not create multiple rows.
 */

const TRACKING_PARAMS = /^utm_|^fbclid$|^gclid$/i;

/** Craigslist post id from .../1234567890.html */
const CL_POST_ID_RE = /(\d{8,})\.html(?:\?|$|#)/i;

/** StreetEasy listing path (building/rental/unit/property/homedetails). */
const SE_PATH_RE =
  /^\/(?:building|rental|unit|property|homedetails)\/[^/]+(?:\/[^/]+)*/i;

export function normalizeListingUrl(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  try {
    const u = new URL(trimmed);
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    if (u.protocol === 'http:') u.protocol = 'https:';

    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }

    let pathname = u.pathname.replace(/\/+/g, '/');
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    u.pathname = pathname;

    const search = u.searchParams.toString();
    return `${u.protocol}//${u.hostname}${pathname}${search ? `?${search}` : ''}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '');
  }
}

export function extractCraigslistPostId(url) {
  const m = String(url).match(CL_POST_ID_RE);
  return m ? m[1] : null;
}

export function extractStreeteasyPathKey(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('streeteasy.com')) return null;
    const path = u.pathname.replace(/\/+$/, '');
    return SE_PATH_RE.test(path) ? path.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Stable dedupe key across crawls (and trailing-slash / http variants).
 * @param {string} url
 * @param {string} [source]
 */
export function listingDedupeKey(url, source = '') {
  const normalized = normalizeListingUrl(url);
  if (!normalized) return '';

  const clId = extractCraigslistPostId(normalized);
  if (clId) return `craigslist:post:${clId}`;

  const sePath = extractStreeteasyPathKey(normalized);
  if (sePath) return `streeteasy:path:${sePath}`;

  return `${source || 'web'}:url:${normalized}`;
}
