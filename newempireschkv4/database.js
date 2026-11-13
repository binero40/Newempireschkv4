const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/empires.db';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Users & Keys
db.exec(`
  CREATE TABLE IF NOT EXISTS keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    label TEXT,
    valid_until TEXT NOT NULL,
    max_checks INTEGER DEFAULT 1000,
    checks_used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS cookies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    is_valid INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_number TEXT NOT NULL,
    expiry TEXT,
    cvv TEXT,
    status TEXT NOT NULL,
    bin_info TEXT,
    country TEXT,
    amazon_type TEXT,
    cookie_country TEXT,
    checked_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS generated_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_number TEXT NOT NULL,
    name TEXT,
    expiry TEXT,
    cvv TEXT,
    bin TEXT,
    country TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_results_status ON results(status);
  CREATE INDEX IF NOT EXISTS idx_keys_key ON keys(key);
`);

module.exports = db;