#!/usr/bin/env node
import { ListingRepository } from '../src/listings/repository.js';
import { NimbleAPIError, NimbleClient } from '../src/nimble/client.js';
import { runVerification } from '../src/verification/verifier.js';
import { parseArgs } from '../src/cli/parseArgs.js';
import { DEFAULT_DB } from '../src/config/env.js';

async function main() {
  const args = parseArgs();
  const borough = args.borough || undefined;
  const source = args.source || undefined;
  const limit = Number(args.limit || 25);
  const statuses = args.status
    ? String(args.status).split(/\s+/)
    : ['active', 'unknown', 'error'];
  const dbPath = args.db || DEFAULT_DB;

  try {
    new NimbleClient();
  } catch (err) {
    console.error(`Config error: ${err.message}`);
    process.exit(1);
  }

  const repo = new ListingRepository(dbPath);
  try {
    const rows = repo.listForVerification({ borough, source, statuses, limit });
    if (!rows.length) {
      console.log('No listings matched. Run npm run ingest first.');
      return;
    }

    console.log(`Verifying ${rows.length} listing(s)...`);
    const outcomes = await runVerification(repo, { borough, source, limit, statuses });

    const live = outcomes.filter((o) => o.result === 'live').length;
    const expired = outcomes.filter((o) => o.result === 'expired').length;
    const other = outcomes.length - live - expired;

    console.log(`\nResults: ${live} live, ${expired} expired, ${other} unknown/error\n`);
    const marks = { live: 'OK', expired: 'DEAD', unknown: '?', error: 'ERR' };
    for (const o of outcomes) {
      console.log(`  [${marks[o.result]}] ${o.source} #${o.listingId}`);
      console.log(`       ${o.url}`);
      console.log(`       ${o.note}`);
    }

    const stats = repo.stats();
    console.log(`\nRepository total: ${stats.total} listings`);
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
