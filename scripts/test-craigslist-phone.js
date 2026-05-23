#!/usr/bin/env node
import { parseContacts } from '../src/nimble/contactParser.js';
import { extractCraigslistListing } from '../src/nimble/craigslistExtract.js';
import {
  closePlaywrightBrowser,
  extractContactsWithPlaywright,
  mergeContacts,
  needsPlaywrightFallback,
} from '../src/scrapers/playwrightContacts.js';

const url =
  process.argv[2] ||
  'https://newyork.craigslist.org/brk/apa/d/brooklyn-no-fee-bed-bath-laundry-in/7935097209.html';

const skipPlaywright = process.argv.includes('--no-playwright');

console.log(`URL: ${url}\n`);

console.log('--- Nimble extract ---');
const { text, isHeldOrRemoved } = await extractCraigslistListing(url);
console.log('held/removed:', isHeldOrRemoved);

const nimbleContacts = parseContacts(text, 'craigslist', { listingUrl: url });
console.log('Nimble contacts:', nimbleContacts);

if (!skipPlaywright && needsPlaywrightFallback(nimbleContacts, 'craigslist', { requireCraigslistPhone: true })) {
  console.log('\n--- Playwright fallback (contact reveal) ---');
  try {
    const pw = await extractContactsWithPlaywright(url, 'craigslist');
    console.log('unavailable:', pw.unavailable);
    console.log('Playwright contacts:', pw.contacts);
    const merged = mergeContacts(nimbleContacts, pw.contacts || {});
    console.log('\nMerged:', merged);
  } catch (err) {
    console.error('Playwright failed:', err.message);
    console.error('Run: npm run playwright:install');
  } finally {
    await closePlaywrightBrowser();
  }
} else if (skipPlaywright) {
  console.log('\n(Skipping Playwright: --no-playwright)');
} else {
  console.log('\n(No Playwright needed — Nimble got enough contact info)');
  await closePlaywrightBrowser();
}
