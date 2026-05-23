import { NimbleClient } from './client.js';
import { parseRentHints } from './parsers.js';

/** @typedef {'craigslist' | 'streeteasy'} Source */
/** @typedef {'lite' | 'deep' | 'fast'} SearchDepth */

const DOMAIN_BY_SOURCE = {
  craigslist: 'craigslist.org',
  streeteasy: 'streeteasy.com',
};

export function buildRentalQuery(borough, source) {
  if (source === 'craigslist') {
    return (
      `site:newyork.craigslist.org ${borough.craigslistArea} apa for rent ` +
      `(718 OR 347 OR 917 OR 929)`
    );
  }
  return `${borough.name} apartments for rent site:streeteasy.com`;
}

function parseResult(boroughId, source, result) {
  const title = result.title || '';
  const snippet = result.description || '';
  const content = result.content || '';
  const combined = [title, snippet, content].filter(Boolean).join(' ');
  const { rentHint, bedrooms, bathrooms } = parseRentHints(combined);

  return {
    source,
    borough: boroughId,
    title,
    url: result.url || '',
    snippet,
    rentHint,
    bedrooms,
    bathrooms,
    content: content || null,
    contentPreview: content.length > 500 ? `${content.slice(0, 500)}...` : content || null,
  };
}

export async function searchRentals(
  borough,
  source,
  { maxResults = 10, searchDepth = 'lite', client } = {},
) {
  const nimble = client || new NimbleClient();
  const query = buildRentalQuery(borough, source);
  const domain = DOMAIN_BY_SOURCE[source];

  const payload = {
    query,
    include_domains: [domain],
    country: 'US',
    locale: 'en',
    max_results: maxResults,
    search_depth: searchDepth,
    focus: 'general',
    output_format: 'markdown',
  };

  const response = await nimble.search(payload);
  const listings = (response.results || []).map((item) =>
    parseResult(borough.id, source, item),
  );
  return { listings, response };
}
