const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { parsePhone } = require('../phoneUtils');
const { getChatLabels, setChatLabels } = require('../whatsapp');

// GET /contacts
router.get('/', (req, res) => {
  const db = getDb();
  const { category_id, status, search, pipeline_stage, assigned_to, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = ['1=1'];
  const params = [];

  if (category_id) { where.push('c.category_id = ?'); params.push(category_id); }
  if (status) { where.push('c.status = ?'); params.push(status); }
  if (pipeline_stage) { where.push('c.pipeline_stage = ?'); params.push(pipeline_stage); }
  if (assigned_to) { where.push('c.assigned_to = ?'); params.push(assigned_to); }
  if (search) {
    where.push('(c.name LIKE ? OR c.phone LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as n FROM contacts c WHERE ${whereClause}`).get(...params).n;
  const contacts = db.prepare(`
    SELECT c.*, cat.name as category_name, cat.color as category_color,
           u.name as assigned_name
    FROM contacts c
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN users u ON c.assigned_to = u.id
    WHERE ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ contacts, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /contacts/export — CSV export
router.get('/export', (req, res) => {
  const db = getDb();
  const { category_id, status, search } = req.query;
  let where = ['1=1'];
  const params = [];
  if (category_id) { where.push('c.category_id = ?'); params.push(category_id); }
  if (status) { where.push('c.status = ?'); params.push(status); }
  if (search) { where.push('(c.name LIKE ? OR c.phone LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

  const contacts = db.prepare(`
    SELECT c.name, c.phone, c.country_name, cat.name as category, c.pipeline_stage,
           c.notes, c.status, c.source, c.created_at
    FROM contacts c LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE ${where.join(' AND ')}
    ORDER BY c.name
  `).all(...params);

  const header = 'nombre,telefono,pais,categoria,pipeline,notas,estado,fuente,creado_en';
  const esc = v => `"${(v || '').toString().replace(/"/g, '""')}"`;
  const rows = contacts.map(c =>
    [c.name, c.phone, c.country_name, c.category, c.pipeline_stage, c.notes, c.status, c.source, c.created_at]
      .map(esc).join(',')
  );

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="contactos.csv"');
  res.send('﻿' + [header, ...rows].join('\r\n'));
});

// GET /contacts/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const contact = db.prepare(`
    SELECT c.*, cat.name as category_name, cat.color as category_color,
           u.name as assigned_name
    FROM contacts c
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN users u ON c.assigned_to = u.id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const messages = db.prepare(
    'SELECT * FROM messages WHERE contact_id = ? ORDER BY sent_at DESC LIMIT 200'
  ).all(req.params.id);

  res.json({ ...contact, messages });
});

// POST /contacts
router.post('/', (req, res) => {
  const db = getDb();
  const { name, phone, category_id, notes, source } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'name and phone are required' });
  const parsed = parsePhone(phone);
  try {
    const result = db.prepare(`
      INSERT INTO contacts (name, phone, country_code, country_flag, country_name, category_id, notes, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, parsed.phone, parsed.country_code, parsed.country_flag, parsed.country_name,
           category_id || null, notes || null, source || 'manual');
    res.status(201).json(db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Phone already exists' });
    throw e;
  }
});

// POST /contacts/import — CSV import
router.post('/import', (req, res) => {
  const db = getDb();
  const { csv } = req.body;
  if (!csv) return res.status(400).json({ error: 'csv required' });

  const lines = csv.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return res.status(400).json({ error: 'CSV needs header row + at least one data row' });

  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["\s]/g, ''));
  const nameIdx = header.findIndex(h => ['nombre','name'].includes(h));
  const phoneIdx = header.findIndex(h => ['telefono','phone','tel'].includes(h));
  if (nameIdx < 0 || phoneIdx < 0) {
    return res.status(400).json({ error: 'CSV must have "nombre" and "telefono" columns' });
  }
  const notesIdx = header.findIndex(h => ['notas','notes'].includes(h));
  const catIdx = header.findIndex(h => ['categoria','category'].includes(h));

  let imported = 0, skipped = 0, errors = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = cols[nameIdx]?.trim();
    const phone = cols[phoneIdx]?.trim();
    if (!name || !phone) { skipped++; continue; }

    let category_id = null;
    if (catIdx >= 0 && cols[catIdx]) {
      const cat = db.prepare('SELECT id FROM categories WHERE name LIKE ?').get(`%${cols[catIdx].trim()}%`);
      if (cat) category_id = cat.id;
    }

    try {
      const parsed = parsePhone(phone);
      db.prepare(`
        INSERT INTO contacts (name, phone, country_code, country_flag, country_name, category_id, notes, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'csv')
      `).run(name, parsed.phone, parsed.country_code, parsed.country_flag, parsed.country_name,
             category_id, notesIdx >= 0 ? (cols[notesIdx] || null) : null);
      imported++;
    } catch (e) {
      if (e.message.includes('UNIQUE')) skipped++;
      else errors.push(`Fila ${i + 1}: ${e.message}`);
    }
  }

  res.json({ imported, skipped, errors: errors.slice(0, 10) });
});

function parseCsvLine(line) {
  const cols = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (c === ',' && !inQuote) {
      cols.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  cols.push(cur);
  return cols;
}

// PATCH /contacts/:id
router.patch('/:id', (req, res) => {
  const db = getDb();
  const { name, category_id, notes, status, pipeline_stage, assigned_to } = req.body;
  const fields = [], params = [];

  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (category_id !== undefined) { fields.push('category_id = ?'); params.push(category_id || null); }
  if (notes !== undefined) { fields.push('notes = ?'); params.push(notes); }
  if (status !== undefined) { fields.push('status = ?'); params.push(status); }
  if (pipeline_stage !== undefined) { fields.push('pipeline_stage = ?'); params.push(pipeline_stage); }
  if (assigned_to !== undefined) { fields.push('assigned_to = ?'); params.push(assigned_to || null); }

  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

  fields.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare(`
    SELECT c.*, cat.name as category_name, cat.color as category_color, u.name as assigned_name
    FROM contacts c
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN users u ON c.assigned_to = u.id
    WHERE c.id = ?
  `).get(req.params.id);
  res.json(updated);

  // Push category change to WhatsApp labels (fire-and-forget)
  if ('category_id' in req.body && updated.wa_chat_id) {
    setImmediate(async () => {
      try {
        const allWaLinked = db.prepare('SELECT wa_label_id FROM categories WHERE wa_label_id IS NOT NULL').all()
          .map(r => r.wa_label_id);
        const currentLabels = await getChatLabels(updated.wa_chat_id);
        const keepLabels = currentLabels
          .filter(l => !allWaLinked.includes(String(l.id)))
          .map(l => String(l.id));
        if (req.body.category_id) {
          const cat = db.prepare('SELECT wa_label_id FROM categories WHERE id = ?').get(req.body.category_id);
          if (cat?.wa_label_id) keepLabels.push(cat.wa_label_id);
        }
        await setChatLabels(updated.wa_chat_id, keepLabels);
      } catch (e) {
        console.error('[contacts] WA label sync error:', e.message);
      }
    });
  }
});

// DELETE /contacts/:id
router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
