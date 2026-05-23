const PLACEHOLDER_PHOTOS = [
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1600&q=80',
];

const BOROUGH_LABELS = {
  manhattan: 'Manhattan',
  brooklyn: 'Brooklyn',
  queens: 'Queens',
  bronx: 'Bronx',
  staten_island: 'Staten Island',
};

function parseRent(rentHint) {
  if (!rentHint) return 0;
  const digits = String(rentHint).replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

function parseBeds(text) {
  if (!text) return 1;
  const lower = text.toLowerCase();
  if (lower.includes('studio')) return 0;
  const m = lower.match(/(\d+)/);
  return m ? Number(m[1]) : 1;
}

function parseBaths(text) {
  if (!text) return 1;
  const m = String(text).match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 1;
}

function mapDbStatus(status) {
  if (status === 'expired') return 'complete';
  if (status === 'error' || status === 'unknown') return 'awaiting';
  return 'matched';
}

function photosForId(id) {
  const n = Number(id) || 0;
  return Array.from({ length: 4 }, (_, i) => PLACEHOLDER_PHOTOS[(n + i) % PLACEHOLDER_PHOTOS.length]);
}

function photosFromRow(row) {
  if (row.photos_json) {
    try {
      const parsed = JSON.parse(row.photos_json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((u) => typeof u === 'string' && u.startsWith('http'));
      }
    } catch {
      /* ignore bad JSON */
    }
  }
  return photosForId(row.id);
}

function matchScoreFromRow(row) {
  const rent = parseRent(row.rent_hint);
  if (!rent) return 72;
  if (row.agent_phone) return 88;
  return 76;
}

/** Map SQLite listing row → JSON shape consumed by web/lib/types Listing */
export function mapRowToWebListing(row) {
  const title = row.title || 'NYC rental';
  const text = `${title} ${row.snippet || ''}`.toLowerCase();
  return {
    id: `db-${row.id}`,
    address: title,
    neighborhood: BOROUGH_LABELS[row.borough] || row.borough || 'NYC',
    pricePerMonth: parseRent(row.rent_hint),
    beds: parseBeds(row.bedrooms),
    baths: parseBaths(row.bathrooms),
    sqftApprox: 650,
    photos: photosFromRow(row),
    brokerName: row.agent_name && !row.agent_name.endsWith(':') ? row.agent_name : 'Contact',
    brokerPhone: row.agent_phone || '',
    listedAt: row.first_seen_at || row.last_seen_at || new Date().toISOString(),
    matchScore: matchScoreFromRow(row),
    status: mapDbStatus(row.status),
    amenities: [],
    noBrokerFee: text.includes('no broker') || text.includes('no fee'),
    description: row.snippet || title,
    listingLink: row.listing_link || row.url,
    source: row.source,
    dbStatus: row.status,
    borough: row.borough,
    agencyName: row.agency_name,
    agentEmail: row.agent_email,
  };
}

export function mapRowsToWebListings(rows) {
  return rows.map(mapRowToWebListing);
}
