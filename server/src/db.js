import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { config } from './config.js';

const dbPath = path.resolve(config.databasePath);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS invite_codes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT NOT NULL UNIQUE,
    label       TEXT,
    max_uses    INTEGER NOT NULL DEFAULT 1,
    used_count  INTEGER NOT NULL DEFAULT 0,
    expires_at  TEXT,                       -- ISO 8601, NULL = never expires
    active      INTEGER NOT NULL DEFAULT 1, -- 0 = revoked
    created_by  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    email          TEXT NOT NULL,
    name           TEXT NOT NULL,
    password_enc   TEXT,                    -- AES-GCM, cleared after provisioning
    status         TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
    invite_code_id INTEGER REFERENCES invite_codes(id) ON DELETE SET NULL,
    submitted_code TEXT,                    -- raw code typed by the user (if any)
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_by    TEXT,
    reviewed_at    TEXT,
    note           TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
  CREATE INDEX IF NOT EXISTS idx_registrations_email  ON registrations(email);
`);
