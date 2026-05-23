#!/usr/bin/env node
import { listingDedupeKey, normalizeListingUrl } from '../src/listings/normalizeUrl.js';

const a = 'https://newyork.craigslist.org/brk/apa/d/foo/1234567890.html';
const b = 'http://NEWYORK.craigslist.org/brk/apa/d/foo/1234567890.html/';

const na = normalizeListingUrl(a);
const nb = normalizeListingUrl(b);
const ka = listingDedupeKey(a, 'craigslist');
const kb = listingDedupeKey(b, 'craigslist');

console.log({ na, nb, sameUrl: na === nb, ka, kb, sameKey: ka === kb });

if (na !== nb || ka !== kb) process.exit(1);
