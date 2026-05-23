import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DATABASE_PATH || './payments.db';

// Ensure the directory for the database exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);

// Initialize database schema
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    available_credits REAL NOT NULL DEFAULT 0,
    held_credits REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS holds (
    id TEXT PRIMARY KEY,
    viewing_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    amount_usdc REAL NOT NULL,
    status TEXT CHECK(status IN ('held', 'released_to_broker', 'refunded_to_user')) NOT NULL DEFAULT 'held',
    broker_wallet_address TEXT,
    broker_label TEXT,
    settle_reason TEXT,
    payout_tx_hash TEXT,
    created_at INTEGER NOT NULL,
    settled_at INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(user_id)
  );
`);

// Prepared statement helpers
export const queries = {
  // User operations
  createUser: db.prepare(`
    INSERT INTO users (user_id, available_credits, held_credits, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      available_credits = available_credits,
      held_credits = held_credits
  `),
  
  getUser: db.prepare(`
    SELECT user_id, available_credits, held_credits, created_at
    FROM users
    WHERE user_id = ?
  `),

  updateUserCredits: db.prepare(`
    UPDATE users
    SET available_credits = ?, held_credits = ?
    WHERE user_id = ?
  `),

  // Hold operations
  createHold: db.prepare(`
    INSERT INTO holds (id, viewing_id, user_id, amount_usdc, status, created_at)
    VALUES (?, ?, ?, ?, 'held', ?)
  `),

  getHold: db.prepare(`
    SELECT id, viewing_id, user_id, amount_usdc, status, broker_wallet_address, broker_label, settle_reason, payout_tx_hash, created_at, settled_at
    FROM holds
    WHERE id = ?
  `),

  getHoldByViewingId: db.prepare(`
    SELECT id, viewing_id, user_id, amount_usdc, status, broker_wallet_address, broker_label, settle_reason, payout_tx_hash, created_at, settled_at
    FROM holds
    WHERE viewing_id = ?
  `),

  getHoldsByUserId: db.prepare(`
    SELECT id, viewing_id, user_id, amount_usdc, status, broker_wallet_address, broker_label, settle_reason, payout_tx_hash, created_at, settled_at
    FROM holds
    WHERE user_id = ?
    ORDER BY created_at DESC
  `),

  updateHoldStatus: db.prepare(`
    UPDATE holds
    SET status = ?, broker_wallet_address = ?, broker_label = ?, settle_reason = ?, payout_tx_hash = ?, settled_at = ?
    WHERE id = ?
  `)
};

// Database transaction helper
export function runInTransaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
