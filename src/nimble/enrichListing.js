import { NimbleClient } from './client.js';
import { extractCraigslistListing, isPostingUnavailable } from './craigslistExtract.js';
import { parseContacts } from './contactParser.js';
import { parseListingPhotos } from './imageParser.js';
import { parseRentHints } from './parsers.js';
import {
  extractCraigslistListingUrls,
  extractStreeteasyListingUrls,
  isCraigslistListingUrl,
  isStreeteasyListingUrl,
} from './parsers.js';
import {
  extractContactsWithPlaywright,
  mergeContacts,
  needsPlaywrightFallback,
} from '../scrapers/playwrightContacts.js';

function pageText(extractResponse) {
  const data = extractResponse.data || {};
  return [data.markdown, data.html, JSON.stringify(data.parsing || {})]
    .filter(Boolean)
    .join('\n');
}

export async function extractListingPage(url, { client, source } = {}) {
  if (source === 'craigslist') {
    return extractCraigslistListing(url, { client });
  }
  const nimble = client || new NimbleClient();
  const response = await nimble.extract({
    url,
    render: true,
    country: 'US',
    state: 'NY',
    city: 'new_york',
    locale: 'en-US',
    render_options: { render_type: 'idle2', timeout: 45000 },
  });
  return {
    response,
    text: pageText(response),
    isHeldOrRemoved: isPostingUnavailable(pageText(response)),
  };
}

export async function discoverListingCandidates(
  searchItems,
  source,
  { client, extractIndexPages = true } = {},
) {
  const seen = new Set();
  const candidates = [];

  const add = (item) => {
    if (!item.url || seen.has(item.url)) return;
    seen.add(item.url);
    candidates.push(item);
  };

  const isListing =
    source === 'craigslist' ? isCraigslistListingUrl : isStreeteasyListingUrl;
  const extractUrls =
    source === 'craigslist' ? extractCraigslistListingUrls : extractStreeteasyListingUrls;

  for (const item of searchItems) {
    if (isListing(item.url)) add(item);

    const blob = [item.title, item.snippet, item.contentPreview].filter(Boolean).join('\n');
    for (const url of extractUrls(blob)) {
      add({ ...item, url });
    }
  }

  if (extractIndexPages) {
    const nimble = client || new NimbleClient();
    const indexPages = searchItems.filter(
      (i) =>
        i.url &&
        !isListing(i.url) &&
        i.url.includes(source === 'craigslist' ? 'craigslist.org' : 'streeteasy.com'),
    );

    for (const page of indexPages.slice(0, 2)) {
      try {
        const { text } = await extractListingPage(page.url, { client: nimble, source });
        for (const url of extractUrls(text)) {
          add({ ...page, url, snippet: page.snippet || 'From search index' });
        }
      } catch {
        // skip failed index extract
      }
    }
  }

  return candidates;
}

export async function enrichListingDetail(
  item,
  source,
  { client, usePlaywrightFallback = true, requireCraigslistPhone = false } = {},
) {
  const { response, text, isHeldOrRemoved } = await extractListingPage(item.url, {
    client,
    source,
  });

  if (isHeldOrRemoved) {
    return unavailableResult(item, source, response);
  }

  let contacts = parseContacts(text, source, { listingUrl: item.url });
  let contactVia = 'nimble';

  const hints = parseRentHints(`${item.title} ${item.snippet} ${text}`);
  let photos = parseListingPhotos(text, source);
  if (item.photos?.length) {
    photos = [...new Set([...item.photos, ...photos])].slice(0, 12);
  }

  const shouldRunPlaywright =
    usePlaywrightFallback &&
    (needsPlaywrightFallback(contacts, source, { requireCraigslistPhone }) ||
      (photos.length === 0 && source === 'craigslist'));

  if (shouldRunPlaywright) {
    try {
      const pw = await extractContactsWithPlaywright(item.url, source);
      if (pw.unavailable) {
        return unavailableResult(item, source, response);
      }
      if (pw.contacts) {
        contacts = mergeContacts(contacts, pw.contacts);
        if (pw.contacts.agentPhone || pw.contacts.agentEmail) {
          contactVia = 'playwright';
        }
      }
      if (pw.photos?.length) {
        photos = [...new Set([...photos, ...pw.photos])].slice(0, 12);
      }
    } catch {
      // Playwright optional; keep Nimble-only contacts/photos
    }
  }

  return {
    listingLink: item.url,
    title: item.title,
    snippet: item.snippet,
    source,
    borough: item.borough,
    agentName: contacts.agentName,
    agencyName: contacts.agencyName,
    agentEmail: contacts.agentEmail,
    agentPhone: contacts.agentPhone,
    contactVia,
    rentHint: hints.rentHint ?? item.rentHint,
    bedrooms: hints.bedrooms ?? item.bedrooms,
    bathrooms: hints.bathrooms ?? item.bathrooms,
    photos,
    rawExtract: response,
  };
}

function unavailableResult(item, source, response) {
  return {
    listingLink: item.url,
    title: item.title,
    snippet: item.snippet,
    source,
    borough: item.borough,
    agentName: null,
    agencyName: null,
    agentEmail: null,
    agentPhone: null,
    unavailable: true,
    contactVia: 'none',
    rentHint: item.rentHint,
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    photos: [],
    rawExtract: response,
  };
}
