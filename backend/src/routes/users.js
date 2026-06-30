const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');

router.get('/', (req, res) => {
  const users = getDb().prepare('SELECT id, email, name, created_at FROM users ORDER BY name').all();
  res.json(users);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { email, name, password } = req.body;
  if (!email || !name || !password) return res.status(400).json({ error: 'email, name, password required' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)').run(email, hash, name);
    res.status(201).json(db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    throw e;
  }
});

router.delete('/:id', (req, res) => {
  if (parseInt(req.params.id) === req.user?.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  getDb().prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
