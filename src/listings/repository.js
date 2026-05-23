import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { DEFAULT_DB, DATA_DIR } from '../config/env.js';
import { dedupeListingRows, normalizeListingRecord } from './dedupe.js';
import { listingDedupeKey, normalizeListingUrl } from './normalizeUrl.js';

function utcNow() {
  return new Date().toISOString();
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  borough TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  listing_link TEXT,
  title TEXT,
  snippet TEXT,
  rent_hint TEXT,
  bedrooms TEXT,
  bathrooms TEXT,
  agent_name TEXT,
  agency_name TEXT,
  agent_email TEXT,
  agent_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_verified_at TEXT,
  verification_note TEXT,
  raw_search_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_listings_borough ON listings(borough);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_source ON listings(source);
CREATE TABLE IF NOT EXISTS verification_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  checked INTEGER DEFAULT 0,
  still_live INTEGER DEFAULT 0,
  expired INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0
);
`;

const CONTACT_COLUMNS = [
  ['listing_link', 'TEXT'],
  ['agent_name', 'TEXT'],
  ['agency_name', 'TEXT'],
  ['agent_email', 'TEXT'],
  ['agent_phone', 'TEXT'],
  ['photos_json', 'TEXT'],
  ['dedupe_key', 'TEXT'],
];

function migrateSchema(db) {
  const existing = new Set(
    db.prepare('PRAGMA table_info(listings)').all().map((c) => c.name),
  );
  for (const [name, type] of CONTACT_COLUMNS) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE listings ADD COLUMN ${name} ${type}`);
    }
  }
}

export class ListingRepository {
  constructor(dbPath = DEFAULT_DB) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(SCHEMA);
    migrateSchema(this.db);
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_listings_phone ON listings(agent_phone)');
    this.consolidateDuplicateListings();
    this.db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_dedupe_key ON listings(dedupe_key)',
    );
  }

  close() {
    this.db.close();
  }

  consolidateDuplicateListings() {
    const rows = this.db.prepare('SELECT * FROM listings').all();
    if (!rows.length) return 0;

    const grouped = new Map();
    for (const row of rows) {
      const key =
        row.dedupe_key ||
        listingDedupeKey(row.url || row.listing_link, row.source);
      if (!key) continue;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    }

    let removed = 0;
    const updateKey = this.db.prepare(
      'UPDATE listings SET dedupe_key = ?, url = ?, listing_link = ? WHERE id = ?',
    );
    const deleteId = this.db.prepare('DELETE FROM listings WHERE id = ?');

    for (const [, group] of grouped) {
      group.sort((a, b) =>
        String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')),
      );
      const keep = group[0];
      const url = normalizeListingUrl(keep.url || keep.listing_link);
      const link = normalizeListingUrl(keep.listing_link || keep.url);
      const dedupeKey = listingDedupeKey(url || link, keep.source);
      updateKey.run(dedupeKey, url, link, keep.id);

      for (const dup of group.slice(1)) {
        deleteId.run(dup.id);
        removed += 1;
      }
    }

    return removed;
  }

  upsertListing(record, { rawSearch } = {}) {
    const now = utcNow();
    const rawJson = rawSearch ? JSON.stringify(rawSearch) : null;
    const normalized = normalizeListingRecord(record);
    const photosJson =
      normalized.photos?.length > 0 ? JSON.stringify(normalized.photos) : null;

    this.db
      .prepare(
        `
      INSERT INTO listings (
        source, borough, url, listing_link, dedupe_key, title, snippet,
        rent_hint, bedrooms, bathrooms,
        agent_name, agency_name, agent_email, agent_phone, photos_json,
        status, first_seen_at, last_seen_at, verification_note, raw_search_json
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
      ON CONFLICT(dedupe_key) DO UPDATE SET
        url = excluded.url,
        listing_link = excluded.listing_link,
        title = excluded.title,
        snippet = excluded.snippet,
        rent_hint = COALESCE(excluded.rent_hint, listings.rent_hint),
        bedrooms = COALESCE(excluded.bedrooms, listings.bedrooms),
        bathrooms = COALESCE(excluded.bathrooms, listings.bathrooms),
        agent_name = COALESCE(excluded.agent_name, listings.agent_name),
        agency_name = COALESCE(excluded.agency_name, listings.agency_name),
        agent_email = COALESCE(excluded.agent_email, listings.agent_email),
        agent_phone = COALESCE(excluded.agent_phone, listings.agent_phone),
        photos_json = CASE
          WHEN excluded.photos_json IS NOT NULL AND excluded.photos_json != '[]'
          THEN excluded.photos_json
          ELSE listings.photos_json
        END,
        last_seen_at = excluded.last_seen_at,
        raw_search_json = COALESCE(excluded.raw_search_json, listings.raw_search_json)
    `,
      )
      .run(
        normalized.source,
        normalized.borough,
        normalized.url,
        normalized.listingLink,
        normalized.dedupeKey,
        normalized.title,
        normalized.snippet,
        normalized.rentHint ?? null,
        normalized.bedrooms ?? null,
        normalized.bathrooms ?? null,
        normalized.agentName ?? null,
        normalized.agencyName ?? null,
        normalized.agentEmail ?? null,
        normalized.agentPhone ?? null,
        photosJson,
        normalized.status || 'active',
        now,
        now,
        normalized.verificationNote ?? null,
        rawJson,
      );

    const row = this.db
      .prepare('SELECT id FROM listings WHERE dedupe_key = ?')
      .get(normalized.dedupeKey);
    return row.id;
  }

  updateVerification(listingId, { status, note }) {
    this.db
      .prepare(
        `
      UPDATE listings
      SET status = ?, verification_note = ?, last_verified_at = ?
      WHERE id = ?
    `,
      )
      .run(status, note, utcNow(), listingId);
  }

  getById(id) {
    return this.db.prepare('SELECT * FROM listings WHERE id = ?').get(id);
  }

  listAll({ borough, source, limit = 200, statuses, since } = {}) {
    const clauses = [];
    const params = [];
    if (borough) {
      clauses.push('borough = ?');
      params.push(borough);
    }
    if (source) {
      clauses.push('source = ?');
      params.push(source);
    }
    if (since) {
      clauses.push('first_seen_at > ?');
      params.push(since);
    }
    if (statuses?.length) {
      clauses.push(`status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limitSql = limit ? `LIMIT ${Number(limit)}` : '';
    const rows = this.db
      .prepare(
        `SELECT * FROM listings ${where} ORDER BY last_seen_at DESC ${limitSql}`,
      )
      .all(...params);
    return dedupeListingRows(rows);
  }

  listForVerification({ borough, source, statuses, limit } = {}) {
    const clauses = [];
    const params = [];

    if (borough) {
      clauses.push('borough = ?');
      params.push(borough);
    }
    if (source) {
      clauses.push('source = ?');
      params.push(source);
    }
    if (statuses?.length) {
      clauses.push(`status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limitSql = limit ? `LIMIT ${Number(limit)}` : '';
    const query = `
      SELECT * FROM listings
      ${where}
      ORDER BY last_verified_at IS NOT NULL, last_verified_at ASC, last_seen_at DESC
      ${limitSql}
    `;
    return this.db.prepare(query).all(...params);
  }

  listWithContacts({ borough, source, limit = 50 } = {}) {
    const clauses = ['agent_phone IS NOT NULL'];
    const params = [];
    if (borough) {
      clauses.push('borough = ?');
      params.push(borough);
    }
    if (source) {
      clauses.push('source = ?');
      params.push(source);
    }
    const query = `
      SELECT id, source, borough, listing_link, title, agent_name, agency_name, agent_email, agent_phone
      FROM listings
      WHERE ${clauses.join(' AND ')}
      ORDER BY last_seen_at DESC
      LIMIT ?
    `;
    params.push(limit);
    return this.db.prepare(query).all(...params);
  }

  startVerificationRun() {
    const now = utcNow();
    const result = this.db
      .prepare('INSERT INTO verification_runs (started_at) VALUES (?)')
      .run(now);
    return result.lastInsertRowid;
  }

  finishVerificationRun(runId, { checked, stillLive, expired, errors }) {
    this.db
      .prepare(
        `
      UPDATE verification_runs
      SET finished_at = ?, checked = ?, still_live = ?, expired = ?, errors = ?
      WHERE id = ?
    `,
      )
      .run(utcNow(), checked, stillLive, expired, errors, runId);
  }

  purgeInvalidPhones() {
    const badAreaCodes = ['793', '086'];
    let removed = 0;
    for (const area of badAreaCodes) {
      const result = this.db
        .prepare(`DELETE FROM listings WHERE agent_phone LIKE ?`)
        .run(`(${area})%`);
      removed += result.changes;
    }
    this.db
      .prepare(
        `DELETE FROM listings WHERE source = 'craigslist' AND agent_phone IS NULL AND url LIKE '%/search/%'`,
      )
      .run();
    return removed;
  }

  stats() {
    const breakdown = this.db
      .prepare(
        `
      SELECT borough, source, status, COUNT(*) AS count
      FROM listings
      GROUP BY borough, source, status
      ORDER BY borough, source, status
    `,
      )
      .all();
    const total = this.db.prepare('SELECT COUNT(*) AS c FROM listings').get();
    const withPhone = this.db
      .prepare('SELECT COUNT(*) AS c FROM listings WHERE agent_phone IS NOT NULL')
      .get();
    const withEmail = this.db
      .prepare('SELECT COUNT(*) AS c FROM listings WHERE agent_email IS NOT NULL')
      .get();
    return {
      total: total.c,
      withPhone: withPhone.c,
      withEmail: withEmail.c,
      breakdown,
    };
  }
}
