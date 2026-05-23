import { listingDedupeKey, normalizeListingUrl } from './normalizeUrl.js';

/** Normalize URLs on an ingest record before upsert. */
export function normalizeListingRecord(record) {
  const url = normalizeListingUrl(record.url || record.listingLink);
  const listingLink = normalizeListingUrl(record.listingLink || record.url || url);
  const source = record.source || '';
  const dedupeKey = listingDedupeKey(url || listingLink, source);
  return {
    ...record,
    url: url || listingLink,
    listingLink: listingLink || url,
    dedupeKey: dedupeKey || `url:${url || listingLink}`,
  };
}

/**
 * Collapse duplicate DB rows (same Craigslist post id / StreetEasy path / URL).
 * Keeps the row with the latest last_seen_at and merges contact fields.
 */
export function dedupeListingRows(rows) {
  const groups = new Map();

  for (const row of rows) {
    const key = listingDedupeKey(row.url || row.listing_link, row.source);
    if (!key) continue;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  const kept = [];
  for (const group of groups.values()) {
    group.sort((a, b) => String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')));
    const winner = { ...group[0] };
    for (const other of group.slice(1)) {
      winner.agent_phone = winner.agent_phone || other.agent_phone;
      winner.agent_email = winner.agent_email || other.agent_email;
      winner.agent_name = winner.agent_name || other.agent_name;
      winner.agency_name = winner.agency_name || other.agency_name;
      winner.photos_json = winner.photos_json || other.photos_json;
      winner.rent_hint = winner.rent_hint || other.rent_hint;
    }
    winner.url = normalizeListingUrl(winner.url || winner.listing_link);
    winner.listing_link = normalizeListingUrl(winner.listing_link || winner.url);
    kept.push(winner);
  }

  return kept.sort((a, b) =>
    String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')),
  );
}
