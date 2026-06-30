const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET /inbox — conversations sorted by last message, with unread count
router.get('/', (req, res) => {
  const db = getDb();
  const { search } = req.query;

  let where = '1=1';
  const params = [];

  if (search) {
    where = '(c.name LIKE ? OR c.phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const conversations = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.phone,
      c.country_flag,
      c.country_name,
      c.profile_pic_url,
      c.status,
      cat.name  AS category_name,
      cat.color AS category_color,
      last_msg.content    AS last_message,
      last_msg.direction  AS last_direction,
      last_msg.sent_at    AS last_message_at,
      (
        SELECT COUNT(*) FROM messages m2
        WHERE m2.contact_id = c.id
          AND m2.direction = 'inbound'
          AND m2.status = 'received'
      ) AS unread_count
    FROM contacts c
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN (
      SELECT contact_id, content, direction, sent_at,
             ROW_NUMBER() OVER (PARTITION BY contact_id ORDER BY sent_at DESC) AS rn
      FROM messages
    ) last_msg ON last_msg.contact_id = c.id AND last_msg.rn = 1
    WHERE ${where}
    ORDER BY COALESCE(last_msg.sent_at, c.created_at) DESC
  `).all(...params);

  res.json(conversations);
});

// PATCH /inbox/:contact_id/read — mark all inbound messages as read
router.patch('/:contact_id/read', (req, res) => {
  const db = getDb();
  db.prepare(`
    UPDATE messages SET status = 'read'
    WHERE contact_id = ? AND direction = 'inbound' AND status = 'received'
  `).run(req.params.contact_id);
  res.json({ ok: true });
});

module.exports = router;
