require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const app = express();
const auth = require('./middleware/auth');

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('dev'));
app.use(express.json());

// Public routes — no auth needed
app.use('/api/auth', require('./routes/auth'));
app.use('/webhook', require('./routes/webhook'));
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Protected routes
app.use('/api/sync',       auth, require('./routes/sync'));
app.use('/api/contacts',   auth, require('./routes/contacts'));
app.use('/api/categories', auth, require('./routes/categories'));
app.use('/api/messages',   auth, require('./routes/messages'));
app.use('/api/stats',      auth, require('./routes/stats'));
app.use('/api/inbox',      auth, require('./routes/inbox'));
app.use('/api/status',     auth, require('./routes/status'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Rinran CRM backend running on port ${PORT}`));
