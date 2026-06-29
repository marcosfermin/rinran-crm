const express = require('express');
const router = express.Router();
const { getStatus } = require('../whatsapp');

router.get('/', async (req, res) => {
  const wa = await getStatus();
  res.json({
    crm: 'ok',
    openwa: wa,
    openwa_url: process.env.OPENWA_URL || null,
  });
});

module.exports = router;
