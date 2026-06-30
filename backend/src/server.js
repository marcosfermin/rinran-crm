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
app.use(express.json());

// Public routes — no auth needed
app.use('/api/auth', require('./routes/auth'));
app.use('/webhook', require('./routes/webhook'));
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Serve uploaded contact photos (public — no auth so <img> tags load directly)
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

// Public photo proxy for WhatsApp CDN URLs — no auth so <img> tags load directly
const { getDb } = require('./db');
const axios = require('axios');
app.get('/api/contacts/:id/photo', async (req, res) => {
  try {
    const contact = getDb().prepare('SELECT profile_pic_url FROM contacts WHERE id = ?').get(req.params.id);
    if (!contact?.profile_pic_url) return res.status(404).end();
    // Local uploads are served directly via /uploads; proxy only external URLs
    if (contact.profile_pic_url.startsWith('/uploads/')) {
      return res.redirect(contact.profile_pic_url);
    }
    const imgRes = await axios.get(contact.profile_pic_url, {
      responseType: 'stream',
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    res.setHeader('Content-Type', imgRes.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    imgRes.data.pipe(res);
  } catch {
    res.status(404).end();
  }
});

// Photo upload endpoint (auth required)
app.post('/api/contacts/:id/photo', auth, (req, res) => {
  const { image } = req.body; // base64: "data:image/jpeg;base64,..."
  if (!image) return res.status(400).json({ error: 'image required' });
  const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return res.status(400).json({ error: 'invalid image format' });
  const ext = match[1].split('/')[1].replace('jpeg', 'jpg');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'image too large (max 5MB)' });
  const filename = `contact_${req.params.id}.${ext}`;
  const filepath = path.join(uploadsDir, filename);
  fs.writeFileSync(filepath, buffer);
  const url = `/uploads/${filename}`;
  getDb().prepare('UPDATE contacts SET profile_pic_url = ?, updated_at = datetime(\'now\') WHERE id = ?').run(url, req.params.id);
  res.json({ url });
});

// Protected routes
app.use('/api/sync',       auth, require('./routes/sync'));
app.use('/api/contacts',   auth, require('./routes/contacts'));
app.use('/api/categories', auth, require('./routes/categories'));
app.use('/api/messages',   auth, require('./routes/messages'));
app.use('/api/stats',      auth, require('./routes/stats'));
app.use('/api/inbox',      auth, require('./routes/inbox'));
app.use('/api/status',     auth, require('./routes/status'));
app.use('/api/templates',  auth, require('./routes/templates'));
app.use('/api/team',       auth, require('./routes/users'));

// WAHA sessions proxy — forwards to WAHA API
const WAHA_URL = process.env.OPENWA_URL?.replace(/\/$/, '') || 'http://waha:3000';
const WAHA_KEY = process.env.OPENWA_API_KEY || '';
app.get('/api/wa/sessions', auth, async (req, res) => {
  try {
    const r = await axios.get(`${WAHA_URL}/api/sessions`, {
      headers: { 'X-Api-Key': WAHA_KEY, Accept: 'application/json' }, timeout: 10000
    });
    res.json(r.data);
  } catch { res.json([]); }
});
app.post('/api/wa/sessions', auth, async (req, res) => {
  try {
    const r = await axios.post(`${WAHA_URL}/api/sessions`, req.body, {
      headers: { 'X-Api-Key': WAHA_KEY, 'Content-Type': 'application/json' }, timeout: 10000
    });
    res.status(r.status).json(r.data);
  } catch (e) { res.status(e.response?.status || 500).json(e.response?.data || { error: e.message }); }
});
app.post('/api/wa/sessions/:name/:action', auth, async (req, res) => {
  try {
    const r = await axios.post(`${WAHA_URL}/api/sessions/${req.params.name}/${req.params.action}`, {}, {
      headers: { 'X-Api-Key': WAHA_KEY }, timeout: 15000
    });
    res.status(r.status).json(r.data);
  } catch (e) { res.status(e.response?.status || 500).json(e.response?.data || { error: e.message }); }
});
app.delete('/api/wa/sessions/:name', auth, async (req, res) => {
  try {
    const r = await axios.delete(`${WAHA_URL}/api/sessions/${req.params.name}`, {
      headers: { 'X-Api-Key': WAHA_KEY }, timeout: 10000
    });
    res.status(r.status).json(r.data || { ok: true });
  } catch (e) { res.status(e.response?.status || 500).json(e.response?.data || { error: e.message }); }
});
app.get('/api/wa/sessions/:name/qr', auth, async (req, res) => {
  try {
    const r = await axios.get(`${WAHA_URL}/api/${req.params.name}/auth/qr`, {
      headers: { 'X-Api-Key': WAHA_KEY }, timeout: 10000
    });
    res.json(r.data);
  } catch (e) { res.status(e.response?.status || 500).json(e.response?.data || { error: e.message }); }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Rinran CRM backend running on port ${PORT}`));
