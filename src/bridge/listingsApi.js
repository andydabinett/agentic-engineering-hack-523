import { ListingRepository } from '../listings/repository.js';
import { BOROUGHS } from '../listings/boroughs.js';
import { listListingsFromClickHouse, sqliteDbExists } from '../clickhouse/listingsRead.js';
export { sqliteDbExists };
import { mapRowToWebListing, mapRowsToWebListings } from './mapListing.js';
import { buildPipelineStats } from './pipelineStats.js';

export function openRepository(dbPath) {
  return new ListingRepository(dbPath);
}

export function listListings(repo, { borough, source, limit = 200, since } = {}) {
  const rows = repo.listAll({ borough, source, limit, since });
  return mapRowsToWebListings(rows);
}

/** SQLite when present; otherwise ClickHouse (for Vercel / fresh cloud deploy). */
export async function listListingsAuto(repo, opts = {}) {
  if (sqliteDbExists() && repo) {
    return listListings(repo, opts);
  }
  if (opts.since) {
    return [];
  }
  return listListingsFromClickHouse(opts);
}

export function getListingById(repo, webId) {
  const dbId = parseDbId(webId);
  if (!dbId) return null;
  const row = repo.getById(dbId);
  return row ? mapRowToWebListing(row) : null;
}

export function parseDbId(webId) {
  if (!webId) return null;
  const s = String(webId);
  if (s.startsWith('db-')) return Number(s.slice(3));
  if (/^\d+$/.test(s)) return Number(s);
  return null;
}

export function getPipelineStats(repo) {
  return buildPipelineStats(repo.stats());
}

export function boroughIdsFromCriteria(criteria = {}) {
  const neighborhood = criteria.neighborhood?.toLowerCase() || '';
  if (!neighborhood) return ['all'];

  for (const [id, meta] of Object.entries(BOROUGHS)) {
    const name = meta.name.toLowerCase();
    const slug = id.replace('_', ' ');
    if (neighborhood.includes(name) || neighborhood.includes(slug)) {
      return [id];
    }
  }
  return ['all'];
}
