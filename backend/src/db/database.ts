/**
 * database.ts — SQLite database initialisation.
 *
 * Opens (or creates) the SQLite database file at backend/data/s3ttle.db,
 * then runs CREATE TABLE IF NOT EXISTS statements so the schema is always
 * up-to-date on first boot or after a server restart.
 *
 * WHY better-sqlite3?
 * It's synchronous — no async/await needed in the store layer — which keeps
 * the code simpler. SQLite is fast enough for beta; the synchronous API
 * doesn't block anything meaningful because the operations are microseconds.
 *
 * WHY WAL MODE?
 * Write-Ahead Logging improves performance for concurrent reads while a write
 * is happening. It also makes the database more resilient to crashes.
 *
 * UPGRADE PATH:
 * When we move to Supabase in Phase 2, only SessionStore.ts and
 * UsageService.ts change. This file and the db import disappear.
 * Nothing above the store layer knows or cares about SQLite.
 */

import Database from 'better-sqlite3';
import path from 'path';

// Resolve path relative to the backend root (two directories up from src/db/)
const DB_PATH = path.resolve(__dirname, '../../data/s3ttle.db');

// Open (or create) the database file. verbose logs every SQL statement in dev.
const db = new Database(DB_PATH, {
  verbose: process.env.NODE_ENV === 'development' ? undefined : undefined,
});

// Enable WAL mode for better performance and crash resilience
db.pragma('journal_mode = WAL');
// Enforce foreign key constraints (SQLite disables them by default)
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────
// All CREATE TABLE statements use IF NOT EXISTS so this is safe to run on
// every server start — it's a no-op if the tables already exist.

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    topic       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'discussing',
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS participants (
    session_id   TEXT NOT NULL REFERENCES sessions(id),
    role         TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar       TEXT NOT NULL,
    device_id    TEXT NOT NULL,
    PRIMARY KEY (session_id, role)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES sessions(id),
    author      TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_session
    ON messages(session_id, created_at);

  CREATE TABLE IF NOT EXISTS usage_records (
    id             TEXT PRIMARY KEY,
    session_id     TEXT NOT NULL,
    input_tokens   INTEGER NOT NULL,
    output_tokens  INTEGER NOT NULL,
    model          TEXT NOT NULL,
    created_at     TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_usage_session
    ON usage_records(session_id);
`);

console.log(`[DB] SQLite database ready at ${DB_PATH}`);

export default db;
