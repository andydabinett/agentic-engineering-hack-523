import { getClient } from './client.js';
import { NYC_RENT_LEDGER_DDL } from './schema.js';
import { ListingRepository } from '../listings/repository.js';
import { DEFAULT_DB } from '../config/env.js';

function parseRent(rentHint) {
  if (!rentHint) return 0;
  const digits = String(rentHint).replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

export async function ensureSchema(client = getClient()) {
  await client.command({ query: NYC_RENT_LEDGER_DDL });
}

export async function syncSqliteToClickHouse({ dbPath = DEFAULT_DB, client } = {}) {
  const ch = client || getClient();
  await ensureSchema(ch);

  const repo = new ListingRepository(dbPath);
  let rows;
  try {
    rows = repo.listAll({ limit: 10_000 });
  } finally {
    repo.close();
  }

  if (!rows.length) {
    return { inserted: 0, rows: [] };
  }

  const now = new Date();
  const payload = rows.map((row) => ({
    listing_id: row.id,
    source: row.source,
    borough: row.borough,
    url: row.url,
    listing_link: row.listing_link || row.url,
    title: row.title || '',
    rent: parseRent(row.rent_hint),
    beds: row.bedrooms || '',
    baths: row.bathrooms || '',
    agent_phone: row.agent_phone,
    agent_email: row.agent_email,
    status: row.status,
    scraped_at: row.last_seen_at || row.first_seen_at || now.toISOString(),
    zip_code: '',
    borough_median_rent: 0,
    price_delta_pct: 0,
    is_high_priority: row.agent_phone ? 1 : 0,
    is_rent_stabilized_match: 0,
  }));

  await ch.insert({
    table: 'nyc_rent_ledger',
    values: payload,
    format: 'JSONEachRow',
  });

  return { inserted: payload.length, rows: payload };
}

export async function getListingAnalytics(listingId, { client } = {}) {
  const ch = client || getClient();
  const result = await ch.query({
    query: `
      WITH latest AS (
        SELECT *
        FROM nyc_rent_ledger
        WHERE listing_id = {id:UInt64}
        ORDER BY scraped_at DESC
        LIMIT 1
      ),
      medians AS (
        SELECT borough, median(rent) AS borough_median_rent
        FROM nyc_rent_ledger
        WHERE rent > 0 AND status = 'active'
        GROUP BY borough
      )
      SELECT
        l.listing_id,
        l.borough,
        l.rent,
        m.borough_median_rent,
        if(
          m.borough_median_rent > 0,
          round((toFloat64(m.borough_median_rent) - l.rent) / m.borough_median_rent * 100, 2),
          0
        ) AS price_delta_pct,
        if(m.borough_median_rent > 0 AND l.rent > 0 AND l.rent < m.borough_median_rent * 0.9, 1, 0) AS is_high_priority,
        l.is_rent_stabilized_match
      FROM latest AS l
      LEFT JOIN medians AS m ON l.borough = m.borough
    `,
    query_params: { id: Number(listingId) },
    format: 'JSONEachRow',
  });
  const rows = await result.json();
  return rows[0] || null;
}
