const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/rinran.db');

let db;

function getDb() {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      country_code TEXT,
      country_flag TEXT,
      country_name TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      source TEXT DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
      content TEXT NOT NULL,
      wa_message_id TEXT,
      status TEXT DEFAULT 'sent',
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS broadcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      total_recipients INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at TEXT
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
    CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_message_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts(category_id);
    CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
  `);

  // Migrations for existing DBs
  try { db.exec('ALTER TABLE contacts ADD COLUMN wa_chat_id TEXT'); } catch {}
  try { db.exec('ALTER TABLE contacts ADD COLUMN profile_pic_url TEXT'); } catch {}
  try { db.exec('ALTER TABLE categories ADD COLUMN wa_label_id TEXT'); } catch {}
  try { db.exec('ALTER TABLE messages ADD COLUMN media_url TEXT'); } catch {}
  try { db.exec('ALTER TABLE messages ADD COLUMN media_type TEXT'); } catch {}
  try { db.exec('ALTER TABLE messages ADD COLUMN media_filename TEXT'); } catch {}
  try { db.exec('ALTER TABLE broadcasts ADD COLUMN media_url TEXT'); } catch {}
  try { db.exec('ALTER TABLE broadcasts ADD COLUMN media_type TEXT'); } catch {}
  try { db.exec('ALTER TABLE broadcasts ADD COLUMN media_filename TEXT'); } catch {}
  try { db.exec("ALTER TABLE contacts ADD COLUMN pipeline_stage TEXT DEFAULT 'nuevo'"); } catch {}
  try { db.exec('ALTER TABLE contacts ADD COLUMN assigned_to INTEGER'); } catch {}
  try { db.exec('ALTER TABLE contacts ADD COLUMN wa_session TEXT'); } catch {}

  const existingCats = db.prepare('SELECT COUNT(*) as n FROM categories').get();
  if (existingCats.n === 0) {
    db.prepare("INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)").run('Lead', '#f59e0b');
    db.prepare("INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)").run('Cliente', '#10b981');
    db.prepare("INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)").run('VIP', '#8b5cf6');
    db.prepare("INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)").run('Inactivo', '#6b7280');
  }

  const existingUsers = db.prepare('SELECT COUNT(*) as n FROM users').get();
  if (existingUsers.n === 0) {
    const email = process.env.ADMIN_EMAIL || 'admin@rinran.com';
    const password = process.env.ADMIN_PASSWORD || 'changeme123';
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)").run(email, hash, 'Admin');
    console.log(`[db] Admin user created: ${email}`);
  }
}

module.exports = { getDb };
