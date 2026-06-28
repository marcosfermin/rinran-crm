const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

router.get('/', (req, res) => {
  const db = getDb();

  const totalContacts = db.prepare("SELECT COUNT(*) as n FROM contacts WHERE status = 'active'").get().n;
  const newToday = db.prepare("SELECT COUNT(*) as n FROM contacts WHERE date(created_at) = date('now')").get().n;
  const totalMessages = db.prepare("SELECT COUNT(*) as n FROM messages WHERE direction = 'outbound'").get().n;
  const inboundToday = db.prepare("SELECT COUNT(*) as n FROM messages WHERE direction = 'inbound' AND date(sent_at) = date('now')").get().n;
  const byCountry = db.prepare("SELECT country_flag, country_name, COUNT(*) as n FROM contacts GROUP BY country_code ORDER BY n DESC LIMIT 10").all();
  const byCategory = db.prepare(`
    SELECT cat.name, cat.color, COUNT(c.id) as n
    FROM categories cat LEFT JOIN contacts c ON c.category_id = cat.id
    GROUP BY cat.id ORDER BY n DESC
  `).all();

  res.json({ totalContacts, newToday, totalMessages, inboundToday, byCountry, byCategory });
});

module.exports = router;
