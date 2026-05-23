import { resolveBoroughs } from './boroughs.js';
import { searchRentals } from '../nimble/realEstateSearch.js';
import { NimbleClient } from '../nimble/client.js';
import {
  discoverListingCandidates,
  enrichListingDetail,
} from '../nimble/enrichListing.js';
import { closePlaywrightBrowser } from '../scrapers/playwrightContacts.js';

function toRecord(enriched) {
  return {
    source: enriched.source,
    borough: enriched.borough,
    url: enriched.listingLink,
    listingLink: enriched.listingLink,
    title: enriched.title,
    snippet: enriched.snippet,
    rentHint: enriched.rentHint,
    bedrooms: enriched.bedrooms,
    bathrooms: enriched.bathrooms,
    agentName: enriched.agentName,
    agencyName: enriched.agencyName,
    agentEmail: enriched.agentEmail,
    agentPhone: enriched.agentPhone,
  };
}

export async function ingestBoroughSource(
  borough,
  source,
  repo,
  {
    maxResults = 10,
    searchDepth = 'deep',
    enrich = true,
    requireCraigslistPhone = true,
    usePlaywrightFallback = true,
    client,
  } = {},
) {
  const nimble = client || new NimbleClient();
  if (source === 'craigslist') {
    repo.purgeInvalidPhones();
  }

  let playwrightUsed = 0;

  const { listings, response } = await searchRentals(borough, source, {
    maxResults,
    searchDepth,
    client: nimble,
  });

  let candidates = listings;
  if (enrich) {
    candidates = await discoverListingCandidates(listings, source, {
      client: nimble,
      extractIndexPages: true,
    });
  }

  let stored = 0;
  let skipped = 0;
  let noPhone = 0;

  const toProcess = candidates.slice(0, maxResults);

  for (const item of toProcess) {
    if (!item.url) {
      skipped += 1;
      continue;
    }

    let record;
    if (enrich) {
      try {
        const enriched = await enrichListingDetail(
          { ...item, borough: borough.id },
          source,
          {
            client: nimble,
            usePlaywrightFallback,
            requireCraigslistPhone,
          },
        );
        record = toRecord(enriched);

        if (enriched.contactVia === 'playwright') {
          playwrightUsed += 1;
        }

        if (enriched.unavailable) {
          skipped += 1;
          continue;
        }

        if (source === 'craigslist' && requireCraigslistPhone && !record.agentPhone) {
          noPhone += 1;
          skipped += 1;
          continue;
        }
      } catch {
        skipped += 1;
        continue;
      }
    } else {
      record = {
        source,
        borough: borough.id,
        url: item.url,
        listingLink: item.url,
        title: item.title,
        snippet: item.snippet,
        rentHint: item.rentHint,
        bedrooms: item.bedrooms,
        bathrooms: item.bathrooms,
      };
      if (source === 'craigslist' && requireCraigslistPhone) {
        noPhone += 1;
        skipped += 1;
        continue;
      }
    }

    repo.upsertListing(record, {
      rawSearch: { searchRequestId: response.request_id, enriched: true },
    });
    stored += 1;
  }

  if (usePlaywrightFallback) {
    await closePlaywrightBrowser();
  }

  return {
    borough: borough.id,
    source,
    discovered: listings.length,
    candidates: candidates.length,
    stored,
    skipped,
    noPhone,
    playwrightUsed,
  };
}

export async function ingestAll(
  repo,
  {
    boroughs,
    sources = ['craigslist', 'streeteasy'],
    maxResults = 10,
    searchDepth = 'deep',
    enrich = true,
    requireCraigslistPhone = true,
    usePlaywrightFallback = true,
    client,
  } = {},
) {
  const resolvedBoroughs = resolveBoroughs(boroughs);
  const nimble = client || new NimbleClient();
  const summaries = [];

  try {
    for (const borough of resolvedBoroughs) {
      for (const source of sources) {
        summaries.push(
          await ingestBoroughSource(borough, source, repo, {
            maxResults,
            searchDepth,
            enrich,
            requireCraigslistPhone,
            usePlaywrightFallback,
            client: nimble,
          }),
        );
      }
    }
    return summaries;
  } finally {
    await closePlaywrightBrowser();
  }
}
