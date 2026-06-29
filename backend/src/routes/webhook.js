const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { parsePhone } = require('../phoneUtils');
const { fromWaId } = require('../whatsapp');

// GET /webhook — health check
router.get('/', (req, res) => {
  res.json({ ok: true, endpoint: 'Rinran CRM webhook active' });
});

// POST /webhook — receives events from WAHA Community
// Payload: { event: "message", session: "...", payload: { id, from, body, fromMe, ... } }
router.post('/', async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  const event = body?.event || '';

  if (!event.includes('message')) return;

  try {
    const db = getDb();
    // WAHA Community uses body.payload (not body.data)
    const msgData = body?.payload || body?.data || {};

    if (msgData.fromMe === true) return;

    const rawFrom = msgData.from || msgData.chatId || msgData.sender?.id || '';
    if (!rawFrom) return;
    if (rawFrom.endsWith('@g.us')) return;
    if (msgData.isStatusBroadcast === true) return;
    if (msgData.hasMedia === true && !msgData.body) return;

    const text = msgData.body || msgData.content || msgData.text || '';
    if (!text.trim()) return;

    const phone = fromWaId(rawFrom);
    const parsed = parsePhone(phone);
    const wa_message_id = msgData.id || null;
    const senderName = msgData.notifyName || msgData.pushName
      || msgData._data?.notifyName
      || `WhatsApp ${parsed.phone}`;

    let contact = db.prepare('SELECT * FROM contacts WHERE phone = ?').get(parsed.phone);
    if (!contact) {
      const r = db.prepare(`
        INSERT INTO contacts (name, phone, country_code, country_flag, country_name, source, wa_chat_id)
        VALUES (?, ?, ?, ?, ?, 'whatsapp', ?)
      `).run(senderName, parsed.phone, parsed.country_code, parsed.country_flag, parsed.country_name, rawFrom);
      contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(r.lastInsertRowid);
      console.log(`[webhook] New contact: ${parsed.phone} (${senderName})`);
    } else if (!contact.wa_chat_id) {
      db.prepare('UPDATE contacts SET wa_chat_id = ? WHERE id = ?').run(rawFrom, contact.id);
    }

    if (wa_message_id) {
      const dup = db.prepare('SELECT id FROM messages WHERE wa_message_id = ?').get(wa_message_id);
      if (dup) return;
    }

    db.prepare(`
      INSERT INTO messages (contact_id, direction, content, wa_message_id, status)
      VALUES (?, 'inbound', ?, ?, 'received')
    `).run(contact.id, text, wa_message_id);

    console.log(`[webhook] ✓ ${parsed.phone} (${senderName}): ${text.slice(0, 80)}`);
  } catch (e) {
    console.error('[webhook] Error:', e.message);
  }
});

module.exports = router;
