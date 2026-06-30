require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const auth = require('./middleware/auth');

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '70mb' }));

// Public routes
app.use('/api/auth', require('./routes/auth'));
app.use('/webhook', require('./routes/webhook'));
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

const { getDb } = require('./db');
const axios = require('axios');

// Photo proxy
app.get('/api/contacts/:id/photo', async (req, res) => {
  try {
    const contact = getDb().prepare('SELECT profile_pic_url FROM contacts WHERE id = ?').get(req.params.id);
    if (!contact?.profile_pic_url) return res.status(404).end();
    if (contact.profile_pic_url.startsWith('/uploads/')) return res.redirect(contact.profile_pic_url);
    const imgRes = await axios.get(contact.profile_pic_url, { responseType: 'stream', timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    res.setHeader('Content-Type', imgRes.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    imgRes.data.pipe(res);
  } catch { res.status(404).end(); }
});

app.post('/api/contacts/:id/photo', auth, (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'image required' });
  const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return res.status(400).json({ error: 'invalid image format' });
  const ext = match[1].split('/')[1].replace('jpeg', 'jpg');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'image too large (max 5MB)' });
  const filename = `contact_${req.params.id}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  const url = `/uploads/${filename}`;
  getDb().prepare("UPDATE contacts SET profile_pic_url = ?, updated_at = datetime('now') WHERE id = ?").run(url, req.params.id);
  res.json({ url });
});

// Protected routes
const { router: messagesRouter, fireBroadcast } = require('./routes/messages');
app.use('/api/sync',          auth, require('./routes/sync'));
app.use('/api/contacts',      auth, require('./routes/contacts'));
app.use('/api/categories',    auth, require('./routes/categories'));
app.use('/api/messages',      auth, messagesRouter);
app.use('/api/stats',         auth, require('./routes/stats'));
app.use('/api/inbox',         auth, require('./routes/inbox'));
app.use('/api/status',        auth, require('./routes/status'));
app.use('/api/templates',     auth, require('./routes/templates'));
app.use('/api/team',          auth, require('./routes/users'));
app.use('/api/auto-reply',    auth, require('./routes/autoReply'));
app.use('/api/saved-filters', auth, require('./routes/savedFilters'));
app.use('/api/settings',      auth, require('./routes/settings'));
app.use('/api/tags',          auth, require('./routes/tags'));
app.use('/api/contacts/:contactId/notes', auth, require('./routes/internalNotes'));
app.use('/api/reminders',     auth, require('./routes/reminders'));
app.use('/api/trash',         auth, require('./routes/trash'));
app.use('/api/webhook-log',   auth, require('./routes/webhookLog'));

const { router: pushRouter, pushToUser, pushToAll } = require('./routes/push');
app.use('/api/push',          auth, pushRouter);

// SSE — real-time push (auth via query param token for EventSource)
const { sseRouter } = require('./routes/sse');
app.get('/api/sse', (req, res) => {
  // Validate token from query string (EventSource can't set headers)
  const token = req.query.token;
  if (!token) return res.status(401).end();
  try {
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'rinran-secret-change-me';
    req.user = jwt.verify(token, secret);
    sseRouter(req, res);
  } catch { res.status(401).end(); }
});

// WAHA sessions proxy
const WAHA_URL = process.env.OPENWA_URL?.replace(/\/$/, '') || 'http://waha:3000';
const WAHA_KEY = process.env.OPENWA_API_KEY || '';
const wahaHdr = () => ({ 'X-Api-Key': WAHA_KEY, Accept: 'application/json' });

app.get('/api/wa/sessions', auth, async (req, res) => {
  try { res.json((await axios.get(`${WAHA_URL}/api/sessions`, { headers: wahaHdr(), timeout: 10000 })).data); }
  catch { res.json([]); }
});
app.post('/api/wa/sessions', auth, async (req, res) => {
  try {
    const r = await axios.post(`${WAHA_URL}/api/sessions`, req.body, { headers: { ...wahaHdr(), 'Content-Type': 'application/json' }, timeout: 10000 });
    res.status(r.status).json(r.data);
  } catch (e) { res.status(e.response?.status || 500).json(e.response?.data || { error: e.message }); }
});
app.post('/api/wa/sessions/:name/:action', auth, async (req, res) => {
  try {
    const r = await axios.post(`${WAHA_URL}/api/sessions/${req.params.name}/${req.params.action}`, {}, { headers: wahaHdr(), timeout: 15000 });
    res.status(r.status).json(r.data);
  } catch (e) { res.status(e.response?.status || 500).json(e.response?.data || { error: e.message }); }
});
app.delete('/api/wa/sessions/:name', auth, async (req, res) => {
  try {
    const r = await axios.delete(`${WAHA_URL}/api/sessions/${req.params.name}`, { headers: wahaHdr(), timeout: 10000 });
    res.status(r.status).json(r.data || { ok: true });
  } catch (e) { res.status(e.response?.status || 500).json(e.response?.data || { error: e.message }); }
});
app.get('/api/wa/sessions/:name/qr', auth, async (req, res) => {
  try {
    const r = await axios.get(`${WAHA_URL}/api/${req.params.name}/auth/qr`, { headers: wahaHdr(), timeout: 10000 });
    res.json(r.data);
  } catch (e) { res.status(e.response?.status || 500).json(e.response?.data || { error: e.message }); }
});

// Reminder scheduler — emit SSE + Web Push when reminders come due
const { broadcast: sseEmit } = require('./routes/sse');
setInterval(async () => {
  try {
    const db = getDb();
    const due = db.prepare("SELECT r.*, c.name as contact_name FROM reminders r JOIN contacts c ON r.contact_id = c.id WHERE r.done = 0 AND r.due_at <= datetime('now')").all();
    for (const r of due) {
      sseEmit('reminder', { id: r.id, title: r.title, contact_id: r.contact_id, contact_name: r.contact_name });
      try {
        await pushToUser(r.user_id, `Recordatorio: ${r.title}`, r.contact_name, { type: 'reminder', contact_id: r.contact_id });
      } catch {}
    }
  } catch {}
}, 30000);

// Broadcast scheduler — check every 60s for scheduled broadcasts ready to fire
setInterval(async () => {
  try {
    const db = getDb();
    const due = db.prepare("SELECT id FROM broadcasts WHERE status = 'scheduled' AND scheduled_at <= datetime('now')").all();
    for (const { id } of due) {
      console.log(`[scheduler] Firing scheduled broadcast #${id}`);
      await fireBroadcast(db, id);
    }
  } catch (e) {
    console.error('[scheduler] Error:', e.message);
  }
}, 60000);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Rinran CRM backend running on port ${PORT}`));
