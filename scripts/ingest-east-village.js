#!/usr/bin/env node
/**
 * Ingest until we have at least TARGET East Village (Manhattan) listings, then sync ClickHouse.
 */
import '../src/config/env.js';
import { ingestAll } from '../src/listings/ingest.js';
import { ListingRepository } from '../src/listings/repository.js';
import { syncSqliteToClickHouse } from '../src/clickhouse/sync.js';
import { DEFAULT_DB } from '../src/config/env.js';
import { NimbleClient } from '../src/nimble/client.js';

const TARGET = Number(process.env.TARGET || 100);
const NEIGHBORHOOD = 'East Village';
const MAX_PER_PASS = 50;

function countEastVillage(repo) {
  const row = repo.db
    .prepare(
      `
    SELECT COUNT(*) AS c FROM listings
    WHERE borough = 'manhattan'
      AND (
        LOWER(COALESCE(title,'')) LIKE '%east village%'
        OR LOWER(COALESCE(snippet,'')) LIKE '%east village%'
        OR LOWER(COALESCE(url,'')) LIKE '%east-village%'
        OR LOWER(COALESCE(url,'')) LIKE '%east%village%'
      )
  `,
    )
    .get();
  return row.c;
}

async function main() {
  new NimbleClient();
  const repo = new ListingRepository(DEFAULT_DB);
  let pass = 0;

  try {
    while (countEastVillage(repo) < TARGET && pass < 6) {
      pass += 1;
      const have = countEastVillage(repo);
      console.log(`Pass ${pass}: ${have}/${TARGET} East Village listings in DB — ingesting...`);

      await ingestAll(repo, {
        boroughs: ['manhattan'],
        sources: ['craigslist', 'streeteasy'],
        maxResults: MAX_PER_PASS,
        searchDepth: 'deep',
        enrich: true,
        requireCraigslistPhone: true,
        usePlaywrightFallback: true,
        neighborhood: NEIGHBORHOOD,
      });
    }

    const total = countEastVillage(repo);
    const stats = repo.stats();
    console.log(`\nEast Village listings: ${total} (target ${TARGET})`);
    console.log(`Repository total: ${stats.total} (with phone: ${stats.withPhone})`);

    const sync = await syncSqliteToClickHouse();
    console.log(`ClickHouse sync: ${sync.inserted} row(s) → nyc_rent_ledger`);
  } finally {
    repo.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
