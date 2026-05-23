import fs from 'fs';
import { DEFAULT_DB } from '../config/env.js';
import { getClickHouseConfig } from '../config/clickhouseEnv.js';
import { getClient } from './client.js';
import { mapRowToWebListing } from '../bridge/mapListing.js';

function clickhouseConfigured() {
  try {
    getClickHouseConfig();
    return true;
  } catch {
    return false;
  }
}

/** Listings from ClickHouse when SQLite file is absent (serverless / fresh deploy). */
export async function listListingsFromClickHouse({ borough, source, limit = 200 } = {}) {
  if (!clickhouseConfigured()) {
    return [];
  }

  const client = getClient();
  const clauses = ['rent > 0'];
  const params = { limit: Number(limit) };
  if (borough) {
    clauses.push('borough = {borough:String}');
    params.borough = borough;
  }
  if (source) {
    clauses.push('source = {source:String}');
    params.source = source;
  }

  const result = await client.query({
    query: `
      SELECT
        listing_id AS id,
        source,
        borough,
        url,
        listing_link,
        title,
        rent AS rent_hint,
        beds AS bedrooms,
        baths AS bathrooms,
        agent_phone,
        agent_email,
        status,
        scraped_at AS last_seen_at,
        scraped_at AS first_seen_at
      FROM (
        SELECT
          *,
          row_number() OVER (PARTITION BY url ORDER BY scraped_at DESC) AS rn
        FROM nyc_rent_ledger
        WHERE ${clauses.join(' AND ')}
      )
      WHERE rn = 1
      ORDER BY last_seen_at DESC
      LIMIT {limit:UInt32}
    `,
    query_params: params,
    format: 'JSONEachRow',
  });

  const rows = await result.json();
  return rows.map((row) =>
    mapRowToWebListing({
      ...row,
      rent_hint: row.rent_hint ? `$${row.rent_hint}` : null,
      snippet: '',
      agent_name: null,
      agency_name: null,
    }),
  );
}

export function sqliteDbExists() {
  try {
    return fs.existsSync(DEFAULT_DB);
  } catch {
    return false;
  }
}
