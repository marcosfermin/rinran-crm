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

  // Messages per day for last 14 days (inbound + outbound separately)
  const msgPerDay = db.prepare(`
    SELECT date(sent_at) as day,
           SUM(CASE WHEN direction='inbound' THEN 1 ELSE 0 END) as inbound,
           SUM(CASE WHEN direction='outbound' THEN 1 ELSE 0 END) as outbound
    FROM messages
    WHERE sent_at >= datetime('now', '-14 days')
    GROUP BY day ORDER BY day
  `).all();

  // Pipeline funnel
  const pipelineFunnel = db.prepare(`
    SELECT pipeline_stage, COUNT(*) as n FROM contacts
    WHERE status = 'active' GROUP BY pipeline_stage
  `).all();

  // Conversation status breakdown
  const convStatusBreakdown = db.prepare(`
    SELECT conv_status, COUNT(*) as n FROM contacts
    WHERE status = 'active' GROUP BY conv_status
  `).all();

  // Average response time (minutes) — time from inbound to next outbound per contact
  const avgResponseTime = db.prepare(`
    SELECT AVG(diff) as avg_minutes FROM (
      SELECT (julianday(o.sent_at) - julianday(i.sent_at)) * 1440 as diff
      FROM messages i
      JOIN messages o ON o.contact_id = i.contact_id
        AND o.direction = 'outbound'
        AND o.sent_at > i.sent_at
        AND o.sent_at <= datetime(i.sent_at, '+24 hours')
      WHERE i.direction = 'inbound'
      GROUP BY i.id
      HAVING diff > 0
      LIMIT 1000
    )
  `).get();

  // Open conversations
  const openConvs = db.prepare("SELECT COUNT(*) as n FROM contacts WHERE conv_status = 'open' AND status = 'active'").get().n;
  const pendingConvs = db.prepare("SELECT COUNT(*) as n FROM contacts WHERE conv_status = 'pending' AND status = 'active'").get().n;

  res.json({
    totalContacts, newToday, totalMessages, inboundToday,
    openConvs, pendingConvs,
    avgResponseMinutes: Math.round(avgResponseTime?.avg_minutes || 0),
    byCountry, byCategory, msgPerDay, pipelineFunnel, convStatusBreakdown,
  });
});

module.exports = router;
