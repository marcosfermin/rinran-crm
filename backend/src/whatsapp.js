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

// Format phone from OpenWA back to E.164
// Handles @c.us, @s.whatsapp.net, and @lid (newer WhatsApp LID format)
function fromWaId(waId) {
  return '+' + waId
    .replace(/@c\.us$/, '')
    .replace(/@s\.whatsapp\.net$/, '')
    .replace(/@lid$/, '')
    .replace(/\s+/g, '');
}

// Resolve a contact ID (including @lid) to real phone number and name
async function getContact(contactId) {
  try {
    const res = await axios.post(`${base()}/getContact`, {
      args: { id: contactId }
    }, { headers: headers(), timeout: 8000 });
    return res.data?.response ?? res.data ?? null;
  } catch {
    return null;
  }
}

// Get all chats (non-group conversations)
async function getAllChats() {
  let raw;
  try {
    const res = await axios.get(`${base()}/getAllChats`, { headers: headers(), timeout: 30000 });
    raw = res.data;
  } catch {
    try {
      const res = await axios.post(`${base()}/getAllChats`, {}, { headers: headers(), timeout: 30000 });
      raw = res.data;
    } catch (e) {
      console.error('[openwa] getAllChats failed:', e.message);
      return [];
    }
  }

  console.log('[openwa] getAllChats raw type:', typeof raw, Array.isArray(raw) ? 'array' : JSON.stringify(raw)?.slice(0, 300));

  // Handle every known response shape
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.response)) return raw.response;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.chats)) return raw.chats;
  if (raw?.response && typeof raw.response === 'object' && !Array.isArray(raw.response)) {
    const vals = Object.values(raw.response);
    if (vals.length && Array.isArray(vals[0])) return vals[0];
  }
  return [];
}

// Get all messages for a chat
async function getChatMessages(chatId, limit = 500) {
  try {
    const res = await axios.post(`${base()}/loadAndGetAllMessagesInChat`, {
      args: { chatId, includeMe: true, limit }
    }, { headers: headers(), timeout: 30000 });
    return res.data?.response ?? res.data ?? [];
  } catch {
    try {
      const res = await axios.post(`${base()}/getAllMessagesInChat`, {
        args: { chatId, includeMe: true }
      }, { headers: headers(), timeout: 30000 });
      return res.data?.response ?? res.data ?? [];
    } catch {
      return [];
    }
  }
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

module.exports = { sendText, getStatus, toWaId, fromWaId, getContact, getAllChats, getChatMessages };
