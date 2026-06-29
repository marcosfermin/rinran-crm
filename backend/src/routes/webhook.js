const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { parsePhone } = require('../phoneUtils');
const { fromWaId, getContact } = require('../whatsapp');

// GET /webhook — health check
router.get('/', (req, res) => {
  res.json({ ok: true, endpoint: 'Rinran CRM webhook active' });
});

async function resolvePhone(rawFrom, msgData) {
  // LID format (@lid) is a WhatsApp internal ID — resolve to real phone via OpenWA API
  if (rawFrom.includes('@lid')) {
    const info = await getContact(rawFrom);
    const realUser = info?.id?.user || info?.number || info?.phone;
    if (realUser) {
      console.log(`[webhook] Resolved LID ${rawFrom} → +${realUser}`);
      return '+' + realUser;
    }
  }
  return fromWaId(rawFrom);
}

// POST /webhook — receives events from OpenWA
router.post('/', async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  const event = body?.event || body?.type || '';

  if (!event.includes('message')) return;

  try {
    const db = getDb();
    const msgData = body?.data || body;

    if (!msgData) return;
    if (msgData.fromMe === true) return;
    if (msgData.isGroup === true) return;
    if (msgData.isStatusBroadcast === true) return;
    if (msgData.mimetype) return; // skip media

    const rawFrom = msgData.from || msgData.chatId || msgData.sender?.id || '';
    if (!rawFrom) return;

    const text = msgData.body || msgData.content || msgData.text || '';
    if (!text.trim()) return;

    const phone = await resolvePhone(rawFrom, msgData);
    const parsed = parsePhone(phone);
    const wa_message_id = msgData.id?._serialized ?? msgData.id ?? null;

    const senderName = msgData.contact?.pushName
      || msgData.contact?.name
      || msgData.sender?.pushname
      || msgData.sender?.name
      || msgData.notifyName
      || `WhatsApp ${parsed.phone}`;

    let contact = db.prepare('SELECT * FROM contacts WHERE phone = ?').get(parsed.phone);
    if (!contact) {
      const r = db.prepare(`
        INSERT INTO contacts (name, phone, country_code, country_flag, country_name, source, wa_chat_id)
        VALUES (?, ?, ?, ?, ?, 'whatsapp', ?)
      `).run(senderName, parsed.phone, parsed.country_code, parsed.country_flag, parsed.country_name, rawFrom);
      contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(r.lastInsertRowid);
      console.log(`[webhook] New contact: ${parsed.phone} (${senderName}) chatId=${rawFrom}`);
    } else if (!contact.wa_chat_id) {
      db.prepare('UPDATE contacts SET wa_chat_id = ? WHERE id = ?').run(rawFrom, contact.id);
    }

    // Avoid duplicate messages
    if (wa_message_id) {
      const dup = db.prepare('SELECT id FROM messages WHERE wa_message_id = ?').get(wa_message_id);
      if (dup) return;
    }

    db.prepare(`
      INSERT INTO messages (contact_id, direction, content, wa_message_id, status)
      VALUES (?, 'inbound', ?, ?, 'received')
    `).run(contact.id, text, wa_message_id);

    console.log(`[webhook] ✓ ${parsed.phone} (${senderName}): ${text}`);
  } catch (e) {
    console.error('[webhook] Error:', e.message);
  }
});

module.exports = router;
