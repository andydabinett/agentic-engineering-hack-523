#!/usr/bin/env node
/**
 * Seed demo listings into SQLite + ClickHouse (no Nimble ingest).
 *
 * Usage:
 *   node scripts/seed-demo.js              # SQLite + ClickHouse
 *   node scripts/seed-demo.js --sqlite-only
 *   node scripts/seed-demo.js --clickhouse-only
 */
import { parseArgs } from '../src/cli/parseArgs.js';
import { DEFAULT_DB } from '../src/config/env.js';
import { getClickHouseConfig } from '../src/config/clickhouseEnv.js';
import { syncSqliteToClickHouse } from '../src/clickhouse/sync.js';
import { ListingRepository } from '../src/listings/repository.js';
import { DEMO_LISTINGS } from './seed-demo-listings.js';

function clickhouseConfigured() {
  try {
    getClickHouseConfig();
    return true;
  } catch {
    return false;
  }
}

function seedSqlite(dbPath) {
  const repo = new ListingRepository(dbPath);
  let stored = 0;
  try {
    for (const row of DEMO_LISTINGS) {
      repo.upsertListing(
        {
          source: row.source,
          borough: row.borough,
          url: row.url,
          listingLink: row.url,
          title: row.title,
          snippet: row.snippet,
          rentHint: row.rentHint,
          bedrooms: row.bedrooms,
          bathrooms: row.bathrooms,
          agentName: row.agentName,
          agencyName: row.agencyName,
          agentEmail: row.agentEmail,
          agentPhone: row.agentPhone,
          photos: [],
        },
        { rawSearch: { seeded: true, demo: true } },
      );
      stored += 1;
    }
    const stats = repo.stats();
    return { stored, total: stats.total, dbPath };
  } finally {
    repo.close();
  }
}

async function main() {
  const args = parseArgs();
  const dbPath = args.db || DEFAULT_DB;
  const sqliteOnly = Boolean(args['sqlite-only']);
  const clickhouseOnly = Boolean(args['clickhouse-only']);

  if (sqliteOnly && clickhouseOnly) {
    console.error('Use at most one of --sqlite-only or --clickhouse-only');
    process.exit(1);
  }

  if (!clickhouseOnly) {
    const { stored, total, dbPath: path } = seedSqlite(dbPath);
    console.log(`SQLite: upserted ${stored} demo listing(s) → ${path} (${total} total)`);
  }

  if (!sqliteOnly) {
    if (!clickhouseConfigured()) {
      console.warn('ClickHouse not configured — skipped sync (set CLICKHOUSE_HOST + CLICKHOUSE_API_KEY)');
      return;
    }
    const sync = await syncSqliteToClickHouse({ dbPath });
    console.log(`ClickHouse: synced ${sync.inserted} row(s) → nyc_rent_ledger`);
    console.log('Analytics (borough median / price delta) will populate on listing detail requests.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
