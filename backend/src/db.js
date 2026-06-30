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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS internal_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contact_tags (
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (contact_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS custom_field_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      field_type TEXT NOT NULL DEFAULT 'text',
      options_json TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS custom_field_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      field_def_id INTEGER NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
      value TEXT,
      UNIQUE(contact_id, field_def_id)
    );

    CREATE INDEX IF NOT EXISTS idx_internal_notes_contact ON internal_notes(contact_id);
    CREATE INDEX IF NOT EXISTS idx_contact_tags ON contact_tags(contact_id);

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      note TEXT,
      due_at TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assignment_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS webhook_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT,
      session TEXT,
      payload TEXT,
      received_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_reminders_contact ON reminders(contact_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at, done);
    CREATE INDEX IF NOT EXISTS idx_webhook_log_received ON webhook_log(received_at);

    CREATE TABLE IF NOT EXISTS auto_reply_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_value TEXT,
      response TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS saved_filters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      filters_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS broadcast_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      broadcast_id INTEGER NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      wa_message_id TEXT,
      sent_at TEXT,
      UNIQUE(broadcast_id, contact_id)
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
    CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_message_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts(category_id);
    CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
    CREATE INDEX IF NOT EXISTS idx_activity_log_contact ON activity_log(contact_id);
    CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_waid ON broadcast_recipients(wa_message_id);
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
  try { db.exec("ALTER TABLE contacts ADD COLUMN conv_status TEXT DEFAULT 'open'"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'admin'"); } catch {}
  try { db.exec('ALTER TABLE messages ADD COLUMN reply_to_id INTEGER'); } catch {}
  try { db.exec('ALTER TABLE messages ADD COLUMN reply_to_content TEXT'); } catch {}
  try { db.exec('ALTER TABLE messages ADD COLUMN reply_to_wa_id TEXT'); } catch {}
  try { db.exec('ALTER TABLE broadcasts ADD COLUMN scheduled_at TEXT'); } catch {}
  try { db.exec("ALTER TABLE broadcasts ADD COLUMN pipeline_stage TEXT"); } catch {}
  try { db.exec("ALTER TABLE broadcasts ADD COLUMN tag_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE contacts ADD COLUMN is_deleted INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN two_fa_secret TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN two_fa_enabled INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE broadcasts ADD COLUMN status TEXT DEFAULT 'completed'"); } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS outbound_webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT 'message.inbound',
      secret TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      scopes TEXT DEFAULT 'read',
      created_by INTEGER NOT NULL,
      last_used_at TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      keys_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
  `);

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
