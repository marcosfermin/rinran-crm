const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

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
  const { name, color } = req.body;
  const fields = [];
  const params = [];
  if (name) { fields.push('name = ?'); params.push(name); }
  if (color) { fields.push('color = ?'); params.push(color); }
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
