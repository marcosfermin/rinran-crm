const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db');
const { sendText, sendFile, toWaId } = require('../whatsapp');

const uploadsDir = path.join(__dirname, '../../../data/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Internal URL WAHA uses to fetch uploaded files (same Docker network)
const BACKEND_INTERNAL = process.env.BACKEND_INTERNAL_URL || 'http://backend:4000';

function saveUpload(base64data, originalFilename) {
  const ext = path.extname(originalFilename) || '.bin';
  const base = path.basename(originalFilename, ext).replace(/[^a-z0-9]/gi, '_').slice(0, 40);
  const filename = `msg_${Date.now()}_${base}${ext}`;
  const buf = Buffer.from(base64data, 'base64');
  if (buf.length > 64 * 1024 * 1024) throw new Error('File too large (max 64MB)');
  fs.writeFileSync(path.join(uploadsDir, filename), buf);
  return filename;
}

// POST /messages/send — single text message
router.post('/send', async (req, res) => {
  const db = getDb();
  const { contact_id, message } = req.body;
  if (!contact_id || !message) return res.status(400).json({ error: 'contact_id and message required' });

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contact_id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  let wa_message_id = null;
  let status = 'sent';

  try {
    const result = await sendText(contact.phone, message, contact.wa_chat_id);
    wa_message_id = result?.id ?? result?.response?.id?._serialized ?? null;
  } catch (e) {
    status = 'failed';
    console.error('[messages] sendText error:', e.response?.data || e.message);
  }

  const row = db.prepare(`
    INSERT INTO messages (contact_id, direction, content, wa_message_id, status)
    VALUES (?, 'outbound', ?, ?, ?)
  `).run(contact_id, message, wa_message_id, status);

  res.json({ id: row.lastInsertRowid, status, wa_message_id });
});

// POST /messages/send-file — single file message
router.post('/send-file', async (req, res) => {
  const db = getDb();
  const { contact_id, data, filename, mimetype, caption } = req.body;
  if (!contact_id || !data || !filename || !mimetype) {
    return res.status(400).json({ error: 'contact_id, data, filename, mimetype required' });
  }

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contact_id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  let savedFilename;
  try {
    savedFilename = saveUpload(data, filename);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const localUrl = `/uploads/${savedFilename}`;
  const waUrl = `${BACKEND_INTERNAL}/uploads/${savedFilename}`;
  const content = caption || filename;
  const chatId = contact.wa_chat_id || toWaId(contact.phone);

  let wa_message_id = null;
  let status = 'sent';

  try {
    const result = await sendFile(chatId, { url: waUrl, filename, mimetype, caption });
    wa_message_id = result?.id ?? result?.response?.id?._serialized ?? null;
  } catch (e) {
    status = 'failed';
    console.error('[messages] sendFile error:', e.response?.data || e.message);
  }

  const row = db.prepare(`
    INSERT INTO messages (contact_id, direction, content, wa_message_id, status, media_url, media_type, media_filename)
    VALUES (?, 'outbound', ?, ?, ?, ?, ?, ?)
  `).run(contact_id, content, wa_message_id, status, localUrl, mimetype, filename);

  res.json({ id: row.lastInsertRowid, status, wa_message_id, media_url: localUrl });
});

// POST /messages/broadcast — bulk send (text or file)
router.post('/broadcast', async (req, res) => {
  const db = getDb();
  const { name, message, category_id, file } = req.body;
  if (!message && !file) return res.status(400).json({ error: 'message or file required' });

  const contacts = category_id
    ? db.prepare("SELECT * FROM contacts WHERE category_id = ? AND status = 'active'").all(category_id)
    : db.prepare("SELECT * FROM contacts WHERE status = 'active'").all();

  // Save broadcast file once (reused for all contacts)
  let broadcastFileUrl = null;
  let broadcastFilename = null;
  let broadcastMimetype = null;
  if (file) {
    try {
      const saved = saveUpload(file.data, file.filename);
      broadcastFileUrl = `/uploads/${saved}`;
      broadcastFilename = file.filename;
      broadcastMimetype = file.mimetype;
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  const broadcastRow = db.prepare(`
    INSERT INTO broadcasts (name, message, category_id, total_recipients, status, media_url, media_type, media_filename)
    VALUES (?, ?, ?, ?, 'sending', ?, ?, ?)
  `).run(name || 'Broadcast', message || '', category_id || null, contacts.length, broadcastFileUrl, broadcastMimetype, broadcastFilename);
  const broadcastId = broadcastRow.lastInsertRowid;

  res.json({ broadcast_id: broadcastId, total: contacts.length });

  let sent = 0, failed = 0;
  for (const contact of contacts) {
    try {
      const chatId = contact.wa_chat_id || toWaId(contact.phone);
      let wa_message_id = null;

      if (file && broadcastFileUrl) {
        const waUrl = `${BACKEND_INTERNAL}${broadcastFileUrl}`;
        const result = await sendFile(chatId, {
          url: waUrl,
          filename: broadcastFilename,
          mimetype: broadcastMimetype,
          caption: file.caption || message || undefined,
        });
        wa_message_id = result?.id ?? result?.response?.id?._serialized ?? null;
        const content = file.caption || message || broadcastFilename;
        db.prepare(`
          INSERT INTO messages (contact_id, direction, content, wa_message_id, status, media_url, media_type, media_filename)
          VALUES (?, 'outbound', ?, ?, 'sent', ?, ?, ?)
        `).run(contact.id, content, wa_message_id, broadcastFileUrl, broadcastMimetype, broadcastFilename);
      } else {
        const result = await sendText(contact.phone, message, contact.wa_chat_id);
        wa_message_id = result?.id ?? result?.response?.id?._serialized ?? null;
        db.prepare(`INSERT INTO messages (contact_id, direction, content, wa_message_id, status) VALUES (?, 'outbound', ?, ?, 'sent')`).run(contact.id, message, wa_message_id);
      }
      sent++;
    } catch {
      const content = file ? (file.caption || file.filename) : message;
      db.prepare(`INSERT INTO messages (contact_id, direction, content, status) VALUES (?, 'outbound', ?, 'failed')`).run(contact.id, content);
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
