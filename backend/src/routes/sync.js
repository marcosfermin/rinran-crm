const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { parsePhone } = require('../phoneUtils');
const { getAllChats, getChatMessages, fromWaId, configureWebhook } = require('../whatsapp');

const state = { running: false, lastSync: null, imported: { contacts: 0, messages: 0 }, error: null };

router.get('/', (req, res) => res.json(state));

router.post('/', async (req, res) => {
  if (state.running) return res.json({ ok: false, message: 'Sync already in progress' });
  state.running = true;
  state.error = null;
  state.imported = { contacts: 0, messages: 0 };
  res.json({ ok: true, message: 'Sync started' });
  const webhookUrl = process.env.WEBHOOK_URL || 'http://backend:4000/webhook';
  configureWebhook(webhookUrl).catch(() => {});
  runSync().catch(e => {
    state.error = e.message;
    state.running = false;
    console.error('[sync] Fatal:', e.message);
  });
});

async function runSync() {
  const db = getDb();
  console.log('[sync] Starting WAHA history sync...');

  try {
    const chats = await getAllChats();
    const individual = chats.filter(c => !c.isGroup);
    console.log(`[sync] ${chats.length} total chats, ${individual.length} individual`);

    for (const chat of individual) {
      try {
        const chatId = chat.id;
        if (!chatId) continue;

        const phone = fromWaId(chatId);
        const parsed = parsePhone(phone);
        const name = chat.name || parsed.phone;

        // Upsert contact
        let contact = db.prepare('SELECT * FROM contacts WHERE phone = ?').get(parsed.phone);
        if (!contact) {
          const r = db.prepare(`
            INSERT INTO contacts (name, phone, country_code, country_flag, country_name, source, wa_chat_id)
            VALUES (?, ?, ?, ?, ?, 'whatsapp', ?)
          `).run(name, parsed.phone, parsed.country_code, parsed.country_flag, parsed.country_name, chatId);
          contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(r.lastInsertRowid);
          state.imported.contacts++;
        } else if (!contact.wa_chat_id) {
          db.prepare('UPDATE contacts SET wa_chat_id = ? WHERE id = ?').run(chatId, contact.id);
        }

        // Get messages — WAHA Core returns empty but tries anyway
        const messages = await getChatMessages(chatId);
        let saved = 0;

        for (const msg of messages) {
          const text = msg.body || msg.content || msg.text || '';
          if (!text.trim()) continue;
          if (msg.mimetype) continue;

          const waId = msg.waMessageId || msg.id?._serialized || msg.id;
          if (!waId) continue;

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

        if (saved > 0) {
          console.log(`[sync] ${parsed.phone} (${name}): ${saved} messages`);
        }
      } catch (e) {
        console.error('[sync] Error on chat:', e.message);
      }
    }

    state.lastSync = new Date().toISOString();
    console.log(`[sync] Done — ${state.imported.contacts} contacts, ${state.imported.messages} messages`);
  } finally {
    state.running = false;
  }
}

module.exports = router;
