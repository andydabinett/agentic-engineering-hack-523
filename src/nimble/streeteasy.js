import { searchRentals, buildRentalQuery } from './realEstateSearch.js';

/** Search StreetEasy rentals for a NYC borough via Nimble. */
export async function searchStreeteasyRentals(borough, options = {}) {
  return searchRentals(borough, 'streeteasy', options);
}

export { buildRentalQuery };
