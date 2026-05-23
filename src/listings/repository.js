import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { DEFAULT_DB, DATA_DIR } from '../config/env.js';

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
  }

  close() {
    this.db.close();
  }

  upsertListing(record, { rawSearch } = {}) {
    const now = utcNow();
    const rawJson = rawSearch ? JSON.stringify(rawSearch) : null;
    const listingLink = record.listingLink || record.url;

    this.db
      .prepare(
        `
      INSERT INTO listings (
        source, borough, url, listing_link, title, snippet,
        rent_hint, bedrooms, bathrooms,
        agent_name, agency_name, agent_email, agent_phone,
        status, first_seen_at, last_seen_at, verification_note, raw_search_json
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
      ON CONFLICT(url) DO UPDATE SET
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
        last_seen_at = excluded.last_seen_at,
        raw_search_json = COALESCE(excluded.raw_search_json, listings.raw_search_json)
    `,
      )
      .run(
        record.source,
        record.borough,
        record.url,
        listingLink,
        record.title,
        record.snippet,
        record.rentHint ?? null,
        record.bedrooms ?? null,
        record.bathrooms ?? null,
        record.agentName ?? null,
        record.agencyName ?? null,
        record.agentEmail ?? null,
        record.agentPhone ?? null,
        record.status || 'active',
        now,
        now,
        record.verificationNote ?? null,
        rawJson,
      );

    return this.db.prepare('SELECT id FROM listings WHERE url = ?').get(record.url).id;
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
