require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Ensure data dir exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/inbox', require('./routes/inbox'));
app.use('/api/status', require('./routes/status'));
app.use('/webhook', require('./routes/webhook'));

app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Rinran CRM backend running on port ${PORT}`));
