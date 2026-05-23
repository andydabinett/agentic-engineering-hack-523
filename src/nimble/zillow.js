import { NimbleClient } from './client.js';
import { parseRentHints } from './parsers.js';

function parseListing(result) {
  const title = result.title || '';
  const snippet = result.description || '';
  const content = result.content || '';
  const combined = [title, snippet, content].filter(Boolean).join(' ');
  const { rentHint, bedrooms, bathrooms } = parseRentHints(combined);

  return {
    title,
    url: result.url || '',
    snippet,
    rentHint,
    bedrooms,
    bathrooms,
    contentPreview: content.length > 500 ? `${content.slice(0, 500)}...` : content || null,
  };
}

export async function searchZillowRentals({
  query = 'New York City apartments for rent',
  maxResults = 5,
  searchDepth = 'deep',
  country = 'US',
  locale = 'en',
  client,
} = {}) {
  const nimble = client || new NimbleClient();
  const payload = {
    query,
    include_domains: ['zillow.com'],
    country,
    locale,
    max_results: maxResults,
    search_depth: searchDepth,
    focus: 'general',
    output_format: 'markdown',
  };

  const response = await nimble.search(payload);
  const listings = (response.results || []).map(parseListing);
  return { listings, response };
}

export async function extractZillowPage(url, { client, render = true } = {}) {
  const nimble = client || new NimbleClient();
  return nimble.extract({
    url,
    render,
    country: 'US',
    state: 'NY',
    city: 'new_york',
    locale: 'en-US',
  });
}
