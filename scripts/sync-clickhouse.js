#!/usr/bin/env node
import { syncSqliteToClickHouse } from '../src/clickhouse/sync.js';
import { DEFAULT_DB } from '../src/config/env.js';
import { parseArgs } from '../src/cli/parseArgs.js';

async function main() {
  const args = parseArgs();
  const dbPath = args.db || DEFAULT_DB;
  const result = await syncSqliteToClickHouse({ dbPath });
  console.log(`Synced ${result.inserted} listing(s) from ${dbPath} → ClickHouse nyc_rent_ledger`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
