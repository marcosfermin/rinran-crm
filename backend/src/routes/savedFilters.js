const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

router.get('/', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM saved_filters WHERE user_id = ? ORDER BY id').all(req.user.id));
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, filters } = req.body;
  if (!name || !filters) return res.status(400).json({ error: 'name and filters required' });
  const r = db.prepare('INSERT INTO saved_filters (user_id, name, filters_json) VALUES (?, ?, ?)').run(req.user.id, name, JSON.stringify(filters));
  res.status(201).json(db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(r.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM saved_filters WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
