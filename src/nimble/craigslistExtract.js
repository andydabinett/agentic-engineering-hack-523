import { NimbleClient } from './client.js';

/** Nimble-only extract for Craigslist (no browser_actions — Playwright handles contact reveal). */
export async function extractCraigslistListing(url, { client } = {}) {
  const nimble = client || new NimbleClient();

  const response = await nimble.extract(
    {
      url,
      render: true,
      country: 'US',
      state: 'NY',
      city: 'new_york',
      locale: 'en-US',
      device: 'desktop',
      render_options: {
        render_type: 'idle2',
        timeout: 60000,
      },
    },
    { timeoutMs: 120_000 },
  );

  const data = response.data || {};
  const text = [data.markdown, data.html, JSON.stringify(data.parsing || {})]
    .filter(Boolean)
    .join('\n');

  return { response, text, isHeldOrRemoved: isPostingUnavailable(text) };
}

export function isPostingUnavailable(text) {
  const lower = text.toLowerCase();
  return (
    lower.includes('this posting has been deleted') ||
    lower.includes('this posting has expired') ||
    lower.includes('has_been_removed') ||
    lower.includes('held for review') ||
    lower.includes('flagged for removal')
  );
}
