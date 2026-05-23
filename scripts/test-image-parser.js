#!/usr/bin/env node
import { parseListingPhotos } from '../src/nimble/imageParser.js';

const clSample = `
<a class="result-image gallery" data-ids="3:00u0u_isZIO2OYkzdz,3:00p0p_fvH8fJ1iO1xz">
<img src="https://images.craigslist.org/00u0u_isZIO2OYkzdz_300x300.jpg">
`;

const urls = parseListingPhotos(clSample, 'craigslist');
console.log('craigslist:', urls);
if (!urls.length) process.exit(1);
