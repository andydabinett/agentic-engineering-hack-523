#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NimbleAPIError, NimbleClient } from '../src/nimble/client.js';
import { extractZillowPage, searchZillowRentals } from '../src/nimble/zillow.js';
import { parseArgs } from '../src/cli/parseArgs.js';
import { DATA_DIR } from '../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function printListings(listings) {
  if (!listings.length) {
    console.log('No Zillow results returned.');
    return;
  }
  console.log(`\nFound ${listings.length} Zillow result(s):\n`);
  listings.forEach((listing, i) => {
    console.log(`${i + 1}. ${listing.title}`);
    console.log(`   URL: ${listing.url}`);
    if (listing.rentHint) console.log(`   Rent hint: ${listing.rentHint}`);
    if (listing.bedrooms || listing.bathrooms) {
      console.log(`   Beds/Baths: ${listing.bedrooms || '?'} / ${listing.bathrooms || '?'}`);
    }
    if (listing.snippet) {
      console.log(`   Snippet: ${listing.snippet.slice(0, 160)}...`);
    }
    console.log();
  });
}

async function main() {
  const args = parseArgs();
  const out = path.resolve(args.out || path.join(DATA_DIR, 'zillow_sample.json'));
  const query = args.query || 'Manhattan NYC apartments for rent 2 bedroom';
  const maxResults = Number(args['max-results'] || 5);
  const depth = args.depth || 'deep';

  if (args['dry-run']) {
    console.log(
      JSON.stringify(
        {
          mode: args['extract-url'] ? 'extract' : 'search',
          searchPayload: {
            query,
            include_domains: ['zillow.com'],
            max_results: maxResults,
            search_depth: depth,
            country: 'US',
            locale: 'en',
          },
          extractUrl: args['extract-url'] || null,
        },
        null,
        2,
      ),
    );
    return;
  }

  try {
    new NimbleClient();
  } catch (err) {
    console.error(`Config error: ${err.message}`);
    process.exit(1);
  }

  const client = new NimbleClient();

  try {
    if (args['extract-url']) {
      console.log(`Extracting Zillow page: ${args['extract-url']}`);
      const raw = await extractZillowPage(args['extract-url'], { client });
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(raw, null, 2));
      console.log(`Saved raw response -> ${out}`);

      const markdown = raw.data?.markdown || '';
      if (markdown) {
        const preview = markdown.length > 800 ? `${markdown.slice(0, 800)}...` : markdown;
        console.log('\nMarkdown preview:\n');
        console.log(preview);
      } else {
        console.log('\nNo markdown in response (check status / parsing fields).');
      }
      return;
    }

    console.log(`Searching Zillow via Nimble (depth=${depth})...`);
    const { listings, response } = await searchZillowRentals({
      query,
      maxResults,
      searchDepth: depth,
      client,
    });

    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(
      out,
      JSON.stringify(
        {
          listings,
          requestId: response.request_id,
          totalResults: response.total_results,
          raw: response,
        },
        null,
        2,
      ),
    );
    console.log(`Saved raw response -> ${out}`);
    console.log(`Request ID: ${response.request_id}`);
    printListings(listings);
  } catch (err) {
    if (err instanceof NimbleAPIError) {
      console.error(`Nimble API error (${err.statusCode}): ${err.message}`);
      if (err.payload) console.error(JSON.stringify(err.payload, null, 2));
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

main();
