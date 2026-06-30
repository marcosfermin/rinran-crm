const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

router.get('/', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM auto_reply_rules ORDER BY id').all());
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, trigger_type, trigger_value, response } = req.body;
  if (!name || !trigger_type || !response) return res.status(400).json({ error: 'name, trigger_type, response required' });
  const r = db.prepare('INSERT INTO auto_reply_rules (name, trigger_type, trigger_value, response) VALUES (?, ?, ?, ?)')
    .run(name, trigger_type, trigger_value || null, response);
  res.status(201).json(db.prepare('SELECT * FROM auto_reply_rules WHERE id = ?').get(r.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const { name, trigger_type, trigger_value, response, is_active } = req.body;
  const fields = [], params = [];
  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (trigger_type !== undefined) { fields.push('trigger_type = ?'); params.push(trigger_type); }
  if (trigger_value !== undefined) { fields.push('trigger_value = ?'); params.push(trigger_value); }
  if (response !== undefined) { fields.push('response = ?'); params.push(response); }
  if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.params.id);
  db.prepare(`UPDATE auto_reply_rules SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  res.json(db.prepare('SELECT * FROM auto_reply_rules WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM auto_reply_rules WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
