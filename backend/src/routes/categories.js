const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { getLabels, getChatLabels, setChatLabels, toWaId } = require('../whatsapp');

router.get('/', (req, res) => {
  const db = getDb();
  const categories = db.prepare(`
    SELECT cat.*, COUNT(c.id) as contact_count
    FROM categories cat
    LEFT JOIN contacts c ON c.category_id = cat.id
    GROUP BY cat.id ORDER BY cat.name
  `).all();
  res.json(categories);
});

// GET /categories/wa-labels — fetch WhatsApp labels for linking
router.get('/wa-labels', async (req, res) => {
  const labels = await getLabels();
  res.json(labels);
});

// POST /categories/sync-all — push every contact's category as a WA label
router.post('/sync-all', async (req, res) => {
  const db = getDb();
  const allLinked = db.prepare('SELECT wa_label_id FROM categories WHERE wa_label_id IS NOT NULL').all().map(r => r.wa_label_id);
  if (!allLinked.length) return res.json({ synced: 0, errors: 0, total: 0, message: 'No hay categorías vinculadas a WhatsApp' });

  const contacts = db.prepare(`
    SELECT co.id, co.phone, co.wa_chat_id, cat.wa_label_id
    FROM contacts co
    JOIN categories cat ON co.category_id = cat.id
    WHERE cat.wa_label_id IS NOT NULL AND co.is_deleted = 0
    AND (co.wa_chat_id IS NOT NULL OR co.phone IS NOT NULL)
  `).all();

  let synced = 0, errors = 0;
  for (const c of contacts) {
    try {
      const chatId = c.wa_chat_id || toWaId(c.phone);
      const current = await getChatLabels(chatId);
      const keep = current.filter(l => !allLinked.includes(String(l.id))).map(l => String(l.id));
      keep.push(c.wa_label_id);
      await setChatLabels(chatId, keep);
      synced++;
    } catch (e) {
      errors++;
      console.error(`[categories] sync error contact ${c.id}:`, e.message);
    }
  }
  console.log(`[categories] sync-all: ${synced} synced, ${errors} errors / ${contacts.length} total`);
  res.json({ synced, errors, total: contacts.length });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const result = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)').run(name, color || '#6366f1');
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Category already exists' });
    throw e;
  }
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const { name, color, wa_label_id } = req.body;
  const fields = [], params = [];
  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (color !== undefined) { fields.push('color = ?'); params.push(color); }
  if (wa_label_id !== undefined) { fields.push('wa_label_id = ?'); params.push(wa_label_id || null); }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.params.id);
  db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
