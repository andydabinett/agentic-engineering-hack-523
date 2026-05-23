const RENT_RE = /\$[\d,]+(?:\s*\/\s*mo(?:nth)?)?/i;
const BED_RE = /(\d+)\s*(?:bd|bed|bedroom)/i;
const BATH_RE = /(\d+(?:\.\d+)?)\s*(?:ba|bath|bathroom)/i;

const CRAIGSLIST_LISTING_RE =
  /https?:\/\/(?:[\w-]+\.)?craigslist\.org\/[a-z]{3}\/[a-z]{3}\/d\/[^?\s#"]+\.html/i;
const STREETEASY_LISTING_RE =
  /https?:\/\/(?:www\.)?streeteasy\.com\/(?:building|rental|unit|property|homedetails)\/[^?\s#"]+/i;

const CRAIGSLIST_URL_GLOB =
  /https?:\/\/(?:[\w-]+\.)?craigslist\.org\/[a-z]{3}\/[a-z]{3}\/d\/[^"\s<>]+?\.html/gi;
const STREETEASY_URL_GLOB =
  /https?:\/\/(?:www\.)?streeteasy\.com\/(?:building|rental|unit|property|homedetails)\/[^"\s<>]+/gi;

export function firstMatch(re, text) {
  const m = text.match(re);
  return m ? m[0] : null;
}

export function parseRentHints(text) {
  return {
    rentHint: firstMatch(RENT_RE, text),
    bedrooms: firstMatch(BED_RE, text),
    bathrooms: firstMatch(BATH_RE, text),
  };
}

export function isCraigslistListingUrl(url) {
  return CRAIGSLIST_LISTING_RE.test(url);
}

export function isStreeteasyListingUrl(url) {
  return STREETEASY_LISTING_RE.test(url);
}

export function extractCraigslistListingUrls(text) {
  return [...new Set((text.match(CRAIGSLIST_URL_GLOB) || []).map((u) => u.replace(/[),.]+$/, '')))];
}

export function extractStreeteasyListingUrls(text) {
  return [...new Set(text.match(STREETEASY_URL_GLOB) || [])];
}
