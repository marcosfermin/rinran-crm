const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET /webhook-log?limit=50
router.get('/', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo admins' });
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const logs = getDb().prepare('SELECT * FROM webhook_log ORDER BY received_at DESC LIMIT ?').all(limit);
  res.json(logs);
});

// DELETE /webhook-log — clear log
router.delete('/', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo admins' });
  getDb().prepare('DELETE FROM webhook_log').run();
  res.json({ ok: true });
});

module.exports = router;
