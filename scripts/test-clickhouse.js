#!/usr/bin/env node
import { ping, version } from '../src/clickhouse/client.js';

async function main() {
  try {
    const one = await ping();
    const ver = await version();
    console.log(`OK: SELECT 1 => ${one}`);
    console.log(`Server version: ${ver}`);
    process.exit(0);
  } catch (err) {
    console.error(`ClickHouse connection failed: ${err.message}`);
    process.exit(1);
  }
}

main();
