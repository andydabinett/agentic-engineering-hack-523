import type { Listing, SearchCriteria } from "./types";

/** Client-side filter aligned with onboarding criteria (ingest already targets borough/source). */
export function listingMatchesCriteria(
  listing: Listing,
  criteria: SearchCriteria,
): boolean {
  if (!criteria.readyToSearch) return true;

  if (criteria.maxPrice != null && listing.pricePerMonth > 0) {
    if (listing.pricePerMonth > criteria.maxPrice) return false;
  }

  if (criteria.bedrooms != null && listing.beds !== criteria.bedrooms) {
    return false;
  }

  const hood = criteria.neighborhood?.trim().toLowerCase();
  if (hood) {
    const hay = `${listing.address} ${listing.neighborhood} ${listing.borough ?? ""} ${listing.description ?? ""}`.toLowerCase();
    const slug = hood.replace(/\s+/g, "_");
    if (!hay.includes(hood) && !hay.includes(slug.replace(/_/g, " "))) {
      return false;
    }
  }

  return true;
}
