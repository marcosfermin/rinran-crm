const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getDb } = require('../db');

const WA_API_URL = `https://graph.facebook.com/v20.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;

async function sendWhatsApp(to, text) {
  const res = await axios.post(WA_API_URL, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  }, {
    headers: {
      Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  return res.data;
}

// POST /messages/send — single message
router.post('/send', async (req, res) => {
  const db = getDb();
  const { contact_id, message } = req.body;
  if (!contact_id || !message) return res.status(400).json({ error: 'contact_id and message required' });

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contact_id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  let wa_message_id = null;
  let status = 'sent';

  try {
    const waRes = await sendWhatsApp(contact.phone, message);
    wa_message_id = waRes.messages?.[0]?.id || null;
  } catch (e) {
    status = 'failed';
    console.error('WhatsApp send error:', e.response?.data || e.message);
  }

  const result = db.prepare(`
    INSERT INTO messages (contact_id, direction, content, wa_message_id, status)
    VALUES (?, 'outbound', ?, ?, ?)
  `).run(contact_id, message, wa_message_id, status);

  res.json({ id: result.lastInsertRowid, status, wa_message_id });
});

// POST /messages/broadcast — bulk send
router.post('/broadcast', async (req, res) => {
  const db = getDb();
  const { name, message, category_id } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  let contacts;
  if (category_id) {
    contacts = db.prepare("SELECT * FROM contacts WHERE category_id = ? AND status = 'active'").all(category_id);
  } else {
    contacts = db.prepare("SELECT * FROM contacts WHERE status = 'active'").all();
  }

  const broadcastResult = db.prepare(`
    INSERT INTO broadcasts (name, message, category_id, total_recipients, status)
    VALUES (?, ?, ?, ?, 'sending')
  `).run(name || 'Broadcast', message, category_id || null, contacts.length);
  const broadcastId = broadcastResult.lastInsertRowid;

  let sent = 0, failed = 0;

  // Fire and respond immediately; process in background
  res.json({ broadcast_id: broadcastId, total: contacts.length });

  for (const contact of contacts) {
    try {
      const waRes = await sendWhatsApp(contact.phone, message);
      const wa_message_id = waRes.messages?.[0]?.id || null;
      db.prepare(`INSERT INTO messages (contact_id, direction, content, wa_message_id, status) VALUES (?, 'outbound', ?, ?, 'sent')`).run(contact.id, message, wa_message_id);
      sent++;
    } catch {
      db.prepare(`INSERT INTO messages (contact_id, direction, content, status) VALUES (?, 'outbound', ?, 'failed')`).run(contact.id, message);
      failed++;
    }
    db.prepare('UPDATE broadcasts SET sent_count = ?, failed_count = ? WHERE id = ?').run(sent, failed, broadcastId);
  }

  db.prepare("UPDATE broadcasts SET status = 'completed', sent_at = datetime('now') WHERE id = ?").run(broadcastId);
});

// GET /messages/broadcasts
router.get('/broadcasts', (req, res) => {
  const db = getDb();
  const broadcasts = db.prepare(`
    SELECT b.*, cat.name as category_name FROM broadcasts b
    LEFT JOIN categories cat ON b.category_id = cat.id
    ORDER BY b.created_at DESC LIMIT 50
  `).all();
  res.json(broadcasts);
});

module.exports = router;
