const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { parsePhone } = require('../phoneUtils');
const { fromWaId } = require('../whatsapp');

// GET /webhook — health check
router.get('/', (req, res) => {
  res.json({ ok: true, endpoint: 'Rinran CRM webhook active' });
});

// POST /webhook — receives events from Evolution API
router.post('/', async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  const event = body?.event || '';

  // Only process incoming message events
  if (event !== 'messages.upsert') return;

  try {
    const db = getDb();
    const msgData = body?.data || {};

    if (msgData?.key?.fromMe === true) return;

    const remoteJid = msgData?.key?.remoteJid || '';
    if (!remoteJid) return;
    if (remoteJid.endsWith('@g.us')) return;
    if (msgData?.messageType === 'protocolMessage') return;
    if (msgData?.messageType === 'senderKeyDistributionMessage') return;

    const text = msgData?.message?.conversation
      || msgData?.message?.extendedTextMessage?.text
      || msgData?.message?.imageMessage?.caption
      || '';
    if (!text.trim()) return;

    const phone = fromWaId(remoteJid);
    const parsed = parsePhone(phone);
    const wa_message_id = msgData?.key?.id || null;
    const senderName = msgData?.pushName || `WhatsApp ${parsed.phone}`;

    let contact = db.prepare('SELECT * FROM contacts WHERE phone = ?').get(parsed.phone);
    if (!contact) {
      const r = db.prepare(`
        INSERT INTO contacts (name, phone, country_code, country_flag, country_name, source, wa_chat_id)
        VALUES (?, ?, ?, ?, ?, 'whatsapp', ?)
      `).run(senderName, parsed.phone, parsed.country_code, parsed.country_flag, parsed.country_name, remoteJid);
      contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(r.lastInsertRowid);
      console.log(`[webhook] New contact: ${parsed.phone} (${senderName})`);
    } else if (!contact.wa_chat_id) {
      db.prepare('UPDATE contacts SET wa_chat_id = ? WHERE id = ?').run(remoteJid, contact.id);
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
