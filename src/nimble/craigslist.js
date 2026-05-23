import { searchRentals, buildRentalQuery } from './realEstateSearch.js';

/** Search Craigslist rentals for a NYC borough via Nimble. */
export async function searchCraigslistRentals(borough, options = {}) {
  return searchRentals(borough, 'craigslist', options);
}

export { buildRentalQuery };
export { extractCraigslistListing, isPostingUnavailable } from './craigslistExtract.js';
