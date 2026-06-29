const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { parsePhone } = require('../phoneUtils');
const { fromWaId } = require('../whatsapp');

// POST /webhook — receives events from OpenWA server
// Configure in OpenWA: middleware.webhook = "http://your-crm/webhook"
router.post('/', (req, res) => {
  const db = getDb();
  res.sendStatus(200); // Acknowledge immediately

  try {
    const { type, data } = req.body;

    // Only handle incoming text messages
    if (type !== 'message') return;
    if (!data) return;

    // Ignore messages sent by us (outbound)
    if (data.fromMe) return;

    // Only handle text messages
    if (data.type && data.type !== 'chat') return;

    const rawFrom = data.from || data.sender?.id || '';
    if (!rawFrom) return;

    const rawPhone = fromWaId(rawFrom);
    const parsed = parsePhone(rawPhone);
    const text = data.body || data.content || '';
    const wa_message_id = data.id?._serialized ?? data.id ?? null;
    const senderName = data.sender?.pushname || data.notifyName || `WhatsApp ${parsed.phone}`;

    let contact = db.prepare('SELECT * FROM contacts WHERE phone = ?').get(parsed.phone);
    if (!contact) {
      const result = db.prepare(`
        INSERT INTO contacts (name, phone, country_code, country_flag, country_name, source)
        VALUES (?, ?, ?, ?, ?, 'whatsapp')
      `).run(senderName, parsed.phone, parsed.country_code, parsed.country_flag, parsed.country_name);
      contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
    }

    db.prepare(`
      INSERT INTO messages (contact_id, direction, content, wa_message_id, status)
      VALUES (?, 'inbound', ?, ?, 'received')
    `).run(contact.id, text, wa_message_id);

    console.log(`[webhook] Inbound from ${parsed.phone} (${senderName}): ${text}`);
  } catch (e) {
    console.error('[webhook] Error:', e.message);
  }
});

module.exports = router;
