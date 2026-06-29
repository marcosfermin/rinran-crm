const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getDb } = require('../db');
const { parsePhone } = require('../phoneUtils');
const { getAllChats, getChatMessages, getContact, fromWaId } = require('../whatsapp');

const state = { running: false, lastSync: null, imported: { contacts: 0, messages: 0 }, error: null };

// GET /api/sync/discover — probe OpenWA to find available API endpoints
router.get('/discover', async (req, res) => {
  const base = process.env.OPENWA_URL?.replace(/\/$/, '') || 'http://localhost:8080';
  const key = process.env.OPENWA_API_KEY;
  const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
  if (key) headers['Authorization'] = `Bearer ${key}`;

  const probes = [
    { method: 'GET',  path: '/api/chats' },
    { method: 'GET',  path: '/chats' },
    { method: 'GET',  path: '/v1/chats' },
    { method: 'GET',  path: '/api/v1/chats' },
    { method: 'POST', path: '/getChats' },
    { method: 'GET',  path: '/getChats' },
    { method: 'GET',  path: '/api/messages' },
    { method: 'GET',  path: '/api' },
    { method: 'GET',  path: '/docs' },
    { method: 'GET',  path: '/swagger' },
    { method: 'GET',  path: '/openapi.json' },
    { method: 'GET',  path: '/api/health' },
    { method: 'GET',  path: '/health' },
  ];

  const results = [];
  for (const { method, path } of probes) {
    try {
      const r = await axios({ method, url: base + path, headers, timeout: 4000 });
      const isJson = r.headers['content-type']?.includes('json');
      results.push({ path, method, status: r.status, json: isJson, preview: isJson ? JSON.stringify(r.data).slice(0, 120) : '(html)' });
    } catch (e) {
      results.push({ path, method, status: e.response?.status || 'ERR', error: e.message.slice(0, 60) });
    }
  }

  console.log('[discover] OpenWA API probe results:');
  results.forEach(r => console.log(` ${r.method} ${r.path} → ${r.status}${r.preview ? ' ' + r.preview : ''}`));

  res.json({ openwa_url: base, results });
});

// GET /api/sync — current sync status
router.get('/', (req, res) => res.json(state));

// POST /api/sync — start sync in background
router.post('/', async (req, res) => {
  if (state.running) return res.json({ ok: false, message: 'Sync already in progress' });

  state.running = true;
  state.error = null;
  state.imported = { contacts: 0, messages: 0 };
  res.json({ ok: true, message: 'Sync started' });

  runSync().catch(e => {
    state.error = e.message;
    state.running = false;
    console.error('[sync] Fatal error:', e.message);
  });
});

async function resolveRealPhone(chatId) {
  if (chatId.includes('@lid')) {
    const info = await getContact(chatId);
    const user = info?.id?.user || info?.number || info?.phone;
    if (user) return '+' + user;
  }
  return fromWaId(chatId);
}

async function runSync() {
  const db = getDb();
  console.log('[sync] Starting full WhatsApp history sync...');

  try {
    const chats = await getAllChats();
    const individualChats = chats.filter(c => !c.isGroup && !c.isReadOnly);
    console.log(`[sync] ${chats.length} total chats, ${individualChats.length} individual`);

    for (const chat of individualChats) {
      try {
        const chatId = chat.id?._serialized || chat.id;
        if (!chatId) continue;

        const phone = await resolveRealPhone(chatId);
        const parsed = parsePhone(phone);

        const name = chat.name
          || chat.contact?.pushName
          || chat.contact?.name
          || parsed.phone;

        // Upsert contact
        let contact = db.prepare('SELECT * FROM contacts WHERE phone = ?').get(parsed.phone);
        if (!contact) {
          const r = db.prepare(`
            INSERT INTO contacts (name, phone, country_code, country_flag, country_name, source)
            VALUES (?, ?, ?, ?, ?, 'whatsapp')
          `).run(name, parsed.phone, parsed.country_code, parsed.country_flag, parsed.country_name);
          contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(r.lastInsertRowid);
          state.imported.contacts++;
          console.log(`[sync] Contact: ${parsed.phone} (${name})`);
        }

        // Get messages for this chat
        const messages = await getChatMessages(chatId);
        let saved = 0;

        for (const msg of messages) {
          const msgType = msg.type || '';
          if (!['chat', 'text', ''].includes(msgType) && !msg.body) continue;
          if (msg.mimetype) continue; // skip media

          const text = msg.body || msg.content || msg.text || '';
          if (!text.trim()) continue;

          const waId = msg.id?._serialized || msg.id;
          if (!waId) continue;

          // Skip duplicates
          const dup = db.prepare('SELECT id FROM messages WHERE wa_message_id = ?').get(waId);
          if (dup) continue;

          const direction = msg.fromMe ? 'outbound' : 'inbound';
          const ts = msg.timestamp
            ? new Date(msg.timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19)
            : null;

          db.prepare(`
            INSERT INTO messages (contact_id, direction, content, wa_message_id, status, sent_at)
            VALUES (?, ?, ?, ?, 'received', COALESCE(?, datetime('now')))
          `).run(contact.id, direction, text, waId, ts);

          state.imported.messages++;
          saved++;
        }

        if (saved > 0) console.log(`[sync]   → ${saved} messages imported`);
      } catch (chatErr) {
        console.error('[sync] Error processing chat:', chatErr.message);
      }
    }

    state.lastSync = new Date().toISOString();
    console.log(`[sync] Done — ${state.imported.contacts} contacts, ${state.imported.messages} messages`);
  } finally {
    state.running = false;
  }
}

module.exports = router;
