const CL_IMAGE_RE =
  /https?:\/\/images\.craigslist\.org\/[A-Za-z0-9_]+(?:_\d+x\d+)?\.jpg/gi;

const SE_IMAGE_RE =
  /https?:\/\/(?:[a-z0-9-]+\.)*(?:streeteasy\.com|zillowstatic\.com|cloudfront\.net)\/[^\s"'<>\\]+\.(?:jpg|jpeg|webp)(?:\?[^\s"'<>\\]*)?/gi;

const OG_IMAGE_RE =
  /<meta[^>]+(?:property=["']og:image["'][^>]+content=["']([^"']+)["']|content=["']([^"']+)["'][^>]+property=["']og:image["'])/gi;

function normalizeCraigslistUrl(url, { large = true } = {}) {
  if (!url) return null;
  let u = url.replace(/&amp;/g, '&').split('?')[0];
  if (large) {
    u = u.replace(/_\d+x\d+\.jpg$/i, '_600x450.jpg');
  }
  return u;
}

/** Build image URLs from Craigslist `data-ids="1:abc,2:def"` attributes. */
function photosFromCraigslistDataIds(text) {
  const urls = [];
  const re = /data-ids\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const parts = match[1].split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const colon = trimmed.indexOf(':');
      const id = colon >= 0 ? trimmed.slice(colon + 1) : trimmed;
      if (id.length > 4) {
        urls.push(`https://images.craigslist.org/${id}_600x450.jpg`);
      }
    }
  }
  return urls;
}

function isAllowedPhotoUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  const lower = url.toLowerCase();
  if (lower.includes('images.craigslist.org')) return true;
  if (lower.includes('streeteasy')) return true;
  if (lower.includes('zillowstatic.com')) return true;
  if (lower.includes('cloudfront.net') && /\/(photo|image|listing|property)/i.test(lower)) {
    return true;
  }
  return false;
}

function dedupeUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const raw of urls) {
    const url = raw?.trim();
    if (!url || !isAllowedPhotoUrl(url)) continue;
    const key = url.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

/**
 * Extract listing photo URLs from Nimble HTML/markdown/JSON text.
 * @param {string} text
 * @param {'craigslist' | 'streeteasy'} source
 * @param {{ max?: number }} [opts]
 * @returns {string[]}
 */
export function parseListingPhotos(text, source, { max = 12 } = {}) {
  if (!text) return [];

  const found = [];

  if (source === 'craigslist' || text.includes('images.craigslist.org')) {
    found.push(...photosFromCraigslistDataIds(text));
    for (const m of text.matchAll(CL_IMAGE_RE)) {
      const normalized = normalizeCraigslistUrl(m[0]);
      if (normalized) found.push(normalized);
    }
  }

  if (source === 'streeteasy') {
    for (const m of text.matchAll(SE_IMAGE_RE)) {
      found.push(m[0].replace(/\\u0026/g, '&'));
    }
    let og;
    while ((og = OG_IMAGE_RE.exec(text)) !== null) {
      const url = og[1] || og[2];
      if (url) found.push(url);
    }
    OG_IMAGE_RE.lastIndex = 0;
  }

  // Nimble structured parsing blobs
  for (const m of text.matchAll(
    /"(?:image_?url|photo_?url|src|url)":\s*"(https?:\\?\/\\?\/[^"]+)"/gi,
  )) {
    const url = m[1].replace(/\\\//g, '/');
    if (isAllowedPhotoUrl(url)) found.push(url);
  }

  return dedupeUrls(found).slice(0, max);
}
