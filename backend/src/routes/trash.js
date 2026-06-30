const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET /trash — soft-deleted contacts
router.get('/', (req, res) => {
  const contacts = getDb().prepare(`
    SELECT c.*, cat.name as category_name, cat.color as category_color
    FROM contacts c LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.is_deleted = 1
    ORDER BY c.updated_at DESC LIMIT 200
  `).all();
  res.json(contacts);
});

// POST /trash/:id/restore
router.post('/:id/restore', (req, res) => {
  getDb().prepare("UPDATE contacts SET is_deleted = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// DELETE /trash/:id — permanent delete
router.delete('/:id', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo admins' });
  getDb().prepare('DELETE FROM contacts WHERE id = ? AND is_deleted = 1').run(req.params.id);
  res.json({ ok: true });
});

// DELETE /trash — empty trash (admin only)
router.delete('/', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo admins' });
  const r = getDb().prepare('DELETE FROM contacts WHERE is_deleted = 1').run();
  res.json({ deleted: r.changes });
});

module.exports = router;
