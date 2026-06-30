const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const authMiddleware = require('../middleware/auth');

const secret = () => process.env.JWT_SECRET || 'rinran-secret-change-me';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const role = user.role || 'admin';
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role },
    secret(),
    { expiresIn: '30d' }
  );

  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role } });
});

// GET /api/auth/me  — requires auth
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/change-password  — requires auth
router.post('/change-password', authMiddleware, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password y new_password requeridos' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Contraseña actual incorrecta' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ ok: true });
});

module.exports = router;
