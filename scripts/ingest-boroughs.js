#!/usr/bin/env node
import { resolveBoroughs } from '../src/listings/boroughs.js';
import { ingestAll } from '../src/listings/ingest.js';
import { ListingRepository } from '../src/listings/repository.js';
import { buildRentalQuery } from '../src/nimble/realEstateSearch.js';
import { NimbleAPIError, NimbleClient } from '../src/nimble/client.js';
import { parseArgs } from '../src/cli/parseArgs.js';
import { DEFAULT_DB } from '../src/config/env.js';

async function main() {
  const args = parseArgs();
  const boroughs = args.boroughs ? String(args.boroughs).split(/\s+/) : ['all'];
  const sources = args.sources
    ? String(args.sources).split(/\s+/)
    : ['craigslist', 'streeteasy'];
  const maxResults = Number(args['max-results'] || 5);
  const depth = args.depth || 'deep';
  const enrich = !args['no-enrich'];
  const requireCraigslistPhone = !args['allow-no-phone'];
  const usePlaywrightFallback = !args['no-playwright'];
  const dbPath = args.db || DEFAULT_DB;

  if (args['dry-run']) {
    const payload = [];
    for (const borough of resolveBoroughs(boroughs)) {
      for (const source of sources) {
        payload.push({
          borough: borough.id,
          source,
          query: buildRentalQuery(borough, source),
          enrich,
          usePlaywrightFallback,
          requireCraigslistPhone: source === 'craigslist' ? requireCraigslistPhone : false,
        });
      }
    }
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  try {
    new NimbleClient();
  } catch (err) {
    console.error(`Config error: ${err.message}`);
    process.exit(1);
  }

  const repo = new ListingRepository(dbPath);
  try {
    console.log(
      `Ingesting ${sources.join(', ')} for boroughs ${boroughs.join(', ')} ` +
        `(depth=${depth}, enrich=${enrich}, playwright=${usePlaywrightFallback}, requireCraigslistPhone=${requireCraigslistPhone})...`,
    );
    const summaries = await ingestAll(repo, {
      boroughs,
      sources,
      maxResults,
      searchDepth: depth,
      enrich,
      requireCraigslistPhone,
      usePlaywrightFallback,
    });
    for (const s of summaries) {
      console.log(
        `  ${s.borough}/${s.source}: searchHits=${s.discovered} candidates=${s.candidates ?? s.discovered} ` +
          `stored=${s.stored} skipped=${s.skipped}` +
          (s.noPhone ? ` noPhone=${s.noPhone}` : '') +
          (s.playwrightUsed ? ` playwright=${s.playwrightUsed}` : ''),
      );
    }
    const stats = repo.stats();
    console.log(`\nRepository total: ${stats.total} (with phone: ${stats.withPhone}, with email: ${stats.withEmail})`);
    console.log(`Database: ${dbPath}`);

    if (!args['no-clickhouse']) {
      try {
        const { syncSqliteToClickHouse } = await import('../src/clickhouse/sync.js');
        const sync = await syncSqliteToClickHouse({ dbPath });
        console.log(`ClickHouse sync: ${sync.inserted} row(s) → nyc_rent_ledger`);
      } catch (chErr) {
        console.warn(`ClickHouse sync skipped: ${chErr.message}`);
      }
    }

    const sample = repo.listWithContacts({ limit: 5 });
    if (sample.length) {
      console.log('\nSample contacts:');
      for (const row of sample) {
        console.log(`  [${row.source}] ${row.title?.slice(0, 50) || row.listing_link}`);
        console.log(`    link: ${row.listing_link}`);
        console.log(`    agent: ${row.agent_name || '-'} | agency: ${row.agency_name || '-'}`);
        console.log(`    phone: ${row.agent_phone || '-'} | email: ${row.agent_email || '-'}`);
      }
    }
  } catch (err) {
    if (err instanceof NimbleAPIError) {
      console.error(`Nimble API error (${err.statusCode}): ${err.message}`);
    } else {
      console.error(err);
    }
    process.exit(1);
  } finally {
    repo.close();
  }
}

main();
