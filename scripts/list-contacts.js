#!/usr/bin/env node
import { ListingRepository } from '../src/listings/repository.js';
import { parseArgs } from '../src/cli/parseArgs.js';
import { DEFAULT_DB } from '../src/config/env.js';

const args = parseArgs();
const repo = new ListingRepository(args.db || DEFAULT_DB);

const rows = repo.listWithContacts({
  borough: args.borough,
  source: args.source,
  limit: Number(args.limit || 50),
});

console.log(JSON.stringify(rows, null, 2));
repo.close();
