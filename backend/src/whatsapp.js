const axios = require('axios');

const base = () => process.env.OPENWA_URL?.replace(/\/$/, '');

function headers() {
  const key = process.env.OPENWA_API_KEY;
  if (!key) return { 'Content-Type': 'application/json' };
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` };
}

// Format phone for OpenWA: +5491122334455 → 5491122334455@c.us
function toWaId(phone) {
  return phone.replace(/^\+/, '').replace(/\s+/g, '') + '@c.us';
}

// Format phone from OpenWA back to E.164: 5491122334455@c.us → +5491122334455
function fromWaId(waId) {
  return '+' + waId.replace('@c.us', '').replace('@s.whatsapp.net', '');
}

async function sendText(phone, text) {
  const url = `${base()}/sendText`;
  const res = await axios.post(url, {
    args: { to: toWaId(phone), content: text }
  }, { headers: headers() });
  return res.data;
}

async function getStatus() {
  try {
    const res = await axios.get(`${base()}/getConnectionState`, {
      headers: headers(), timeout: 5000
    });
    return { connected: true, state: res.data?.response ?? res.data };
  } catch {
    return { connected: false, state: null };
  }
}

module.exports = { sendText, getStatus, toWaId, fromWaId };
