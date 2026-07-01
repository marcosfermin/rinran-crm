const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

router.get('/', (req, res) => {
  const db = getDb();
  const days = Math.min(parseInt(req.query.days) || 14, 365);
  const from = req.query.from || null;
  const to = req.query.to || null;
  const useRange = from && to;
  // Bind from/to as parameters — never interpolate them into SQL (SQL injection).
  // `days` is already a sanitized integer, so its interpolation is safe.
  const dateParams = useRange ? [from, to] : [];
  const dateFilter = useRange
    ? `AND date(sent_at) >= ? AND date(sent_at) <= ?`
    : `AND sent_at >= datetime('now', '-${days} days')`;
  const contactDateFilter = useRange
    ? `AND date(created_at) >= ? AND date(created_at) <= ?`
    : `AND created_at >= datetime('now', '-${days} days')`;

  const totalContacts = db.prepare("SELECT COUNT(*) as n FROM contacts WHERE status = 'active' AND is_deleted != 1").get().n;
  const newToday = db.prepare("SELECT COUNT(*) as n FROM contacts WHERE date(created_at) = date('now') AND is_deleted != 1").get().n;
  const newInRange = db.prepare(`SELECT COUNT(*) as n FROM contacts WHERE is_deleted != 1 ${contactDateFilter}`).get(...dateParams).n;
  const totalMessages = db.prepare(`SELECT COUNT(*) as n FROM messages WHERE direction = 'outbound' ${dateFilter}`).get(...dateParams).n;
  const inboundToday = db.prepare("SELECT COUNT(*) as n FROM messages WHERE direction = 'inbound' AND date(sent_at) = date('now')").get().n;
  const inboundInRange = db.prepare(`SELECT COUNT(*) as n FROM messages WHERE direction = 'inbound' ${dateFilter}`).get(...dateParams).n;
  const byCountry = db.prepare("SELECT country_flag, country_name, COUNT(*) as n FROM contacts WHERE is_deleted != 1 GROUP BY country_code ORDER BY n DESC LIMIT 10").all();
  const byCategory = db.prepare(`
    SELECT cat.name, cat.color, COUNT(c.id) as n
    FROM categories cat LEFT JOIN contacts c ON c.category_id = cat.id AND c.is_deleted != 1
    GROUP BY cat.id ORDER BY n DESC
  `).all();

  const msgPerDay = db.prepare(`
    SELECT date(sent_at) as day,
           SUM(CASE WHEN direction='inbound' THEN 1 ELSE 0 END) as inbound,
           SUM(CASE WHEN direction='outbound' THEN 1 ELSE 0 END) as outbound
    FROM messages
    WHERE 1=1 ${dateFilter}
    GROUP BY day ORDER BY day
  `).all(...dateParams);

  const pipelineFunnel = db.prepare(`
    SELECT c.pipeline_stage, ps.label, ps.color, COUNT(*) as n
    FROM contacts c
    LEFT JOIN pipeline_stages ps ON ps.key = c.pipeline_stage
    WHERE c.status = 'active' AND c.is_deleted != 1
    GROUP BY c.pipeline_stage
    ORDER BY ps.sort_order, c.pipeline_stage
  `).all();

  const convStatusBreakdown = db.prepare(`
    SELECT conv_status, COUNT(*) as n FROM contacts
    WHERE status = 'active' AND is_deleted != 1 GROUP BY conv_status
  `).all();

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

  const openConvs = db.prepare("SELECT COUNT(*) as n FROM contacts WHERE conv_status = 'open' AND status = 'active' AND is_deleted != 1").get().n;
  const pendingConvs = db.prepare("SELECT COUNT(*) as n FROM contacts WHERE conv_status = 'pending' AND status = 'active' AND is_deleted != 1").get().n;

  // Agent metrics
  const agentMetrics = db.prepare(`
    SELECT u.id, u.name,
      COUNT(DISTINCT c.id) as conversations,
      COUNT(DISTINCT CASE WHEN c.conv_status = 'open' THEN c.id END) as open_convs,
      (
        SELECT AVG((julianday(o.sent_at) - julianday(i.sent_at)) * 1440)
        FROM messages i
        JOIN messages o ON o.contact_id = i.contact_id
          AND o.direction = 'outbound'
          AND o.sent_at > i.sent_at
          AND o.sent_at <= datetime(i.sent_at, '+24 hours')
        JOIN contacts ac ON ac.id = i.contact_id AND ac.assigned_to = u.id
        WHERE i.direction = 'inbound'
        LIMIT 500
      ) as avg_response_minutes
    FROM users u
    LEFT JOIN contacts c ON c.assigned_to = u.id AND c.status = 'active' AND c.is_deleted != 1
    GROUP BY u.id
    ORDER BY conversations DESC
  `).all();

  // Overdue reminders count
  const overdueReminders = db.prepare("SELECT COUNT(*) as n FROM reminders WHERE done = 0 AND due_at < datetime('now')").get().n;

  res.json({
    totalContacts, newToday, newInRange, totalMessages, inboundToday, inboundInRange,
    openConvs, pendingConvs,
    avgResponseMinutes: Math.round(avgResponseTime?.avg_minutes || 0),
    byCountry, byCategory, msgPerDay, pipelineFunnel, convStatusBreakdown,
    agentMetrics, overdueReminders,
    days, from, to,
  });
});

// GET /stats/export — CSV export of key metrics
router.get('/export', (req, res) => {
  const db = getDb();
  const contacts = db.prepare(`
    SELECT c.name, c.phone, c.country_name, cat.name as category, c.pipeline_stage,
           c.conv_status, u.name as agent, c.source, c.created_at,
           (SELECT COUNT(*) FROM messages m WHERE m.contact_id = c.id) as msg_count
    FROM contacts c
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN users u ON c.assigned_to = u.id
    WHERE c.is_deleted != 1
    ORDER BY c.created_at DESC
  `).all();

  const header = 'nombre,telefono,pais,categoria,pipeline,estado_conv,agente,fuente,creado_en,mensajes';
  const esc = v => `"${(v || '').toString().replace(/"/g, '""')}"`;
  const rows = contacts.map(c =>
    [c.name, c.phone, c.country_name, c.category, c.pipeline_stage, c.conv_status, c.agent, c.source, c.created_at, c.msg_count].map(esc).join(',')
  );

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="rinran_export.csv"');
  res.send('﻿' + [header, ...rows].join('\r\n'));
});

module.exports = router;
