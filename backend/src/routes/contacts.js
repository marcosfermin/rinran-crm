const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { parsePhone } = require('../phoneUtils');
const { getChatLabels, setChatLabels } = require('../whatsapp');

// GET /contacts
router.get('/', (req, res) => {
  const db = getDb();
  const { category_id, status, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = ['1=1'];
  const params = [];

  if (category_id) { where.push('c.category_id = ?'); params.push(category_id); }
  if (status) { where.push('c.status = ?'); params.push(status); }
  if (search) {
    where.push('(c.name LIKE ? OR c.phone LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = where.join(' AND ');

  const total = db.prepare(`SELECT COUNT(*) as n FROM contacts c WHERE ${whereClause}`).get(...params).n;
  const contacts = db.prepare(`
    SELECT c.*, cat.name as category_name, cat.color as category_color
    FROM contacts c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ contacts, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /contacts/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const contact = db.prepare(`
    SELECT c.*, cat.name as category_name, cat.color as category_color
    FROM contacts c LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const messages = db.prepare(
    'SELECT * FROM messages WHERE contact_id = ? ORDER BY sent_at DESC LIMIT 100'
  ).all(req.params.id);

  res.json({ ...contact, messages });
});

// POST /contacts
router.post('/', (req, res) => {
  const db = getDb();
  const { name, phone, category_id, notes, source } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'name and phone are required' });

  const parsed = parsePhone(phone);

  try {
    const result = db.prepare(`
      INSERT INTO contacts (name, phone, country_code, country_flag, country_name, category_id, notes, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, parsed.phone, parsed.country_code, parsed.country_flag, parsed.country_name,
           category_id || null, notes || null, source || 'manual');

    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(contact);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Phone already exists' });
    throw e;
  }
});

// PATCH /contacts/:id
router.patch('/:id', (req, res) => {
  const db = getDb();
  const { name, category_id, notes, status } = req.body;
  const fields = [];
  const params = [];

  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (category_id !== undefined) { fields.push('category_id = ?'); params.push(category_id); }
  if (notes !== undefined) { fields.push('notes = ?'); params.push(notes); }
  if (status !== undefined) { fields.push('status = ?'); params.push(status); }

  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

  fields.push('updated_at = datetime(\'now\')');
  params.push(req.params.id);

  db.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  res.json(updated);

  // Push category change to WhatsApp labels (fire-and-forget)
  if ('category_id' in req.body && updated.wa_chat_id) {
    setImmediate(async () => {
      try {
        const allWaLinked = db.prepare('SELECT wa_label_id FROM categories WHERE wa_label_id IS NOT NULL').all()
          .map(r => r.wa_label_id);
        const currentLabels = await getChatLabels(updated.wa_chat_id);
        // Keep labels not managed by CRM
        const keepLabels = currentLabels
          .filter(l => !allWaLinked.includes(String(l.id)))
          .map(l => String(l.id));
        // Add new category's WA label if it has one
        if (req.body.category_id) {
          const cat = db.prepare('SELECT wa_label_id FROM categories WHERE id = ?').get(req.body.category_id);
          if (cat?.wa_label_id) keepLabels.push(cat.wa_label_id);
        }
        await setChatLabels(updated.wa_chat_id, keepLabels);
        console.log(`[contacts] WA labels updated for ${updated.wa_chat_id}: [${keepLabels.join(',')}]`);
      } catch (e) {
        console.error('[contacts] WA label sync error:', e.message);
      }
    });
  }
});

// DELETE /contacts/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
