#!/usr/bin/env node
import { ensureSchema } from '../src/clickhouse/sync.js';

async function main() {
  await ensureSchema();
  console.log('ClickHouse table nyc_rent_ledger is ready.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
