const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { parsePhone } = require('../phoneUtils');
const { fromWaId } = require('../whatsapp');

// GET /webhook — health check
router.get('/', (req, res) => {
  res.json({ ok: true, endpoint: 'Rinran CRM webhook active' });
});

// POST /webhook — receives events from OpenWA server
router.post('/', (req, res) => {
  res.sendStatus(200); // Acknowledge immediately

  const body = req.body;
  const event = body?.event || body?.type || '';

  // Only handle incoming message events
  if (!event.includes('message') && event !== 'message') {
    console.log('[webhook] Ignoring event:', event);
    return;
  }

  try {
    const db = getDb();

    // OpenWA sends: { event: "message.received", data: { from, body, fromMe, type, contact, ... } }
    const msgData = body?.data || body;

    if (!msgData) return;

    // Skip outbound messages
    if (msgData.fromMe === true) return;

    // Skip group messages
    if (msgData.isGroup === true) return;

    // Skip status broadcasts
    if (msgData.isStatusBroadcast === true) return;

    // Skip media (images, audio, etc.) — no text to store
    if (msgData.mimetype) return;

    const rawFrom = msgData.from || msgData.chatId || msgData.sender?.id || '';
    if (!rawFrom) {
      console.log('[webhook] No "from" field found');
      return;
    }

    const rawPhone = fromWaId(rawFrom);
    const parsed = parsePhone(rawPhone);
    const text = msgData.body || msgData.content || msgData.text || '';

    if (!text.trim()) return;

    const wa_message_id = msgData.id?._serialized ?? msgData.id ?? null;

    // Name: try multiple fields depending on OpenWA version
    const senderName = msgData.contact?.pushName
      || msgData.contact?.name
      || msgData.sender?.pushname
      || msgData.sender?.name
      || msgData.notifyName
      || msgData.senderName
      || `WhatsApp ${parsed.phone}`;

    let contact = db.prepare('SELECT * FROM contacts WHERE phone = ?').get(parsed.phone);
    if (!contact) {
      const result = db.prepare(`
        INSERT INTO contacts (name, phone, country_code, country_flag, country_name, source)
        VALUES (?, ?, ?, ?, ?, 'whatsapp')
      `).run(senderName, parsed.phone, parsed.country_code, parsed.country_flag, parsed.country_name);
      contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
      console.log(`[webhook] New contact: ${parsed.phone} (${senderName})`);
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
