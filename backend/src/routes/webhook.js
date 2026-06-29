const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { parsePhone } = require('../phoneUtils');
const { fromWaId } = require('../whatsapp');

// GET /webhook — health check
router.get('/', (req, res) => {
  res.json({ ok: true, endpoint: 'Rinran CRM webhook — POST only' });
});

// POST /webhook — receives events from OpenWA server
router.post('/', (req, res) => {
  res.sendStatus(200); // Acknowledge immediately

  const body = req.body;
  console.log('[webhook] RAW PAYLOAD:', JSON.stringify(body, null, 2));

  try {
    const db = getDb();

    // OpenWA can send two formats:
    // Format A: { type: "message", data: { from, body, fromMe, sender, ... } }
    // Format B: direct message object { from, body, fromMe, type: "chat", sender, ... }

    let msgData = null;

    if (body?.type === 'message' && body?.data) {
      // Format A
      msgData = body.data;
    } else if (body?.from && !body?.fromMe && body?.type !== 'message') {
      // Format B — top-level message object
      msgData = body;
    } else if (body?.type === 'message' && !body?.data) {
      // Format A without data wrapper — try top level
      msgData = body;
    }

    if (!msgData) {
      console.log('[webhook] Unrecognized or non-message payload, ignoring. type:', body?.type);
      return;
    }

    // Skip outbound
    if (msgData.fromMe) {
      console.log('[webhook] Skipping outbound message');
      return;
    }

    // Skip non-text (images, audio, etc.)
    const msgType = msgData.type || msgData.mimetype ? 'media' : 'chat';
    if (msgData.mimetype) {
      console.log('[webhook] Skipping media message, mimetype:', msgData.mimetype);
      return;
    }

    const rawFrom = msgData.from || msgData.sender?.id || msgData.chatId || '';
    if (!rawFrom) {
      console.log('[webhook] No "from" field found in payload');
      return;
    }

    const rawPhone = fromWaId(rawFrom);
    const parsed = parsePhone(rawPhone);
    const text = msgData.body || msgData.content || msgData.text || '';
    const wa_message_id = msgData.id?._serialized ?? msgData.id ?? null;
    const senderName = msgData.sender?.pushname
      || msgData.sender?.name
      || msgData.notifyName
      || msgData.senderName
      || `WhatsApp ${parsed.phone}`;

    if (!text) {
      console.log('[webhook] Empty text, skipping');
      return;
    }

    let contact = db.prepare('SELECT * FROM contacts WHERE phone = ?').get(parsed.phone);
    if (!contact) {
      const result = db.prepare(`
        INSERT INTO contacts (name, phone, country_code, country_flag, country_name, source)
        VALUES (?, ?, ?, ?, ?, 'whatsapp')
      `).run(senderName, parsed.phone, parsed.country_code, parsed.country_flag, parsed.country_name);
      contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
      console.log(`[webhook] New contact created: ${parsed.phone} (${senderName})`);
    }

    db.prepare(`
      INSERT INTO messages (contact_id, direction, content, wa_message_id, status)
      VALUES (?, 'inbound', ?, ?, 'received')
    `).run(contact.id, text, wa_message_id);

    console.log(`[webhook] ✓ Message saved — from ${parsed.phone} (${senderName}): ${text}`);
  } catch (e) {
    console.error('[webhook] Error processing payload:', e.message);
    console.error(e.stack);
  }
});

module.exports = router;
