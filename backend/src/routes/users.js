const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');

router.get('/', (req, res) => {
  const users = getDb().prepare("SELECT id, email, name, role, created_at FROM users ORDER BY name").all();
  res.json(users.map(u => ({ ...u, role: u.role || 'admin' })));
});

router.post('/', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo admins pueden crear usuarios' });
  const db = getDb();
  const { email, name, password, role = 'agent' } = req.body;
  if (!email || !name || !password) return res.status(400).json({ error: 'email, name, password required' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)').run(email, hash, name, role);
    const u = db.prepare("SELECT id, email, name, role, created_at FROM users WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json({ ...u, role: u.role || 'admin' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    throw e;
  }
});

router.patch('/:id', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo admins pueden modificar usuarios' });
  const db = getDb();
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'role required' });
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo admins pueden eliminar usuarios' });
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
  getDb().prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
