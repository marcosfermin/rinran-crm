const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { parsePhone } = require('../phoneUtils');

// Webhook verification (Meta requires GET with hub.challenge)
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    console.log('Webhook verified by Meta');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Incoming messages from Meta
router.post('/', (req, res) => {
  const db = getDb();
  res.sendStatus(200); // Acknowledge immediately

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;

        // Handle inbound messages
        for (const msg of value.messages || []) {
          if (msg.type !== 'text') continue;

          const rawPhone = '+' + msg.from;
          const parsed = parsePhone(rawPhone);
          const text = msg.text?.body || '';
          const wa_message_id = msg.id;

          // Upsert contact (create if new)
          let contact = db.prepare('SELECT * FROM contacts WHERE phone = ?').get(parsed.phone);
          if (!contact) {
            // Try to get name from profile
            const profile = value.contacts?.find(c => c.wa_id === msg.from);
            const name = profile?.profile?.name || `WhatsApp ${msg.from}`;

            const result = db.prepare(`
              INSERT INTO contacts (name, phone, country_code, country_flag, country_name, source)
              VALUES (?, ?, ?, ?, ?, 'whatsapp')
            `).run(name, parsed.phone, parsed.country_code, parsed.country_flag, parsed.country_name);

            contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
          }

          db.prepare(`
            INSERT INTO messages (contact_id, direction, content, wa_message_id, status)
            VALUES (?, 'inbound', ?, ?, 'received')
          `).run(contact.id, text, wa_message_id);

          console.log(`Inbound from ${parsed.phone}: ${text}`);
        }
      }
    }
  } catch (e) {
    console.error('Webhook processing error:', e.message);
  }
});

module.exports = router;
