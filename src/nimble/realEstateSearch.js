import { NimbleClient } from './client.js';
import { parseListingPhotos } from './imageParser.js';
import { parseRentHints } from './parsers.js';

/** @typedef {'craigslist' | 'streeteasy'} Source */
/** @typedef {'lite' | 'deep' | 'fast'} SearchDepth */

const DOMAIN_BY_SOURCE = {
  craigslist: 'craigslist.org',
  streeteasy: 'streeteasy.com',
};

export function buildRentalQuery(borough, source, neighborhood) {
  const hood = neighborhood?.trim();
  const hoodQuoted = hood ? `"${hood}"` : '';
  const clArea = hood
    ? `${hoodQuoted} site:newyork.craigslist.org/${borough.id === 'manhattan' ? 'mnh' : borough.craigslistArea}`
    : `site:newyork.craigslist.org ${borough.craigslistArea}`;
  if (source === 'craigslist') {
    return `${clArea} apa for rent (718 OR 347 OR 917 OR 929)`;
  }
  const seArea = hood ? `${hoodQuoted} ${borough.name}` : borough.name;
  return `${seArea} apartments for rent site:streeteasy.com/for-rent/nyc`;
}

function parseResult(boroughId, source, result) {
  const title = result.title || '';
  const snippet = result.description || '';
  const content = result.content || '';
  const combined = [title, snippet, content].filter(Boolean).join(' ');
  const { rentHint, bedrooms, bathrooms } = parseRentHints(combined);
  const photos = parseListingPhotos(combined, source);

  return {
    source,
    borough: boroughId,
    title,
    url: result.url || '',
    snippet,
    rentHint,
    bedrooms,
    bathrooms,
    photos,
    content: content || null,
    contentPreview: content.length > 500 ? `${content.slice(0, 500)}...` : content || null,
  };
}

export async function searchRentals(
  borough,
  source,
  { maxResults = 10, searchDepth = 'lite', neighborhood, client } = {},
) {
  const nimble = client || new NimbleClient();
  const query = buildRentalQuery(borough, source, neighborhood);
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
