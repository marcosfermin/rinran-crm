const axios = require('axios');

const base = () => process.env.OPENWA_URL?.replace(/\/$/, '');

function headers() {
  const key = process.env.OPENWA_API_KEY;
  const h = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (key) h['X-Api-Key'] = key;
  return h;
}

// Cache the active WAHA session
let _session = null;
async function getSession() {
  if (_session) return _session;
  const res = await axios.get(`${base()}/api/sessions`, { headers: headers(), timeout: 10000 });
  const list = Array.isArray(res.data) ? res.data : [];
  _session = list.find(s => s.status === 'WORKING' || s.status === 'ready') || list[0] || null;
  return _session;
}

function resetSession() { _session = null; }

// Phone ↔ WhatsApp ID helpers
function toWaId(phone) {
  return phone.replace(/^\+/, '').replace(/\s+/g, '') + '@c.us';
}

function fromWaId(waId) {
  return '+' + waId
    .replace(/@c\.us$/, '')
    .replace(/@s\.whatsapp\.net$/, '')
    .replace(/@lid$/, '')
    .replace(/\s+/g, '');
}

// Send a text message via WAHA REST format
async function sendText(phone, text, waChatId) {
  const session = await getSession();
  const chatId = waChatId || toWaId(phone);
  const res = await axios.post(`${base()}/api/sendText`, {
    chatId,
    text,
    session: session?.name || 'default',
  }, { headers: headers() });
  return res.data;
}

// Get connection state
async function getStatus() {
  try {
    const session = await getSession().catch(() => null);
    return { connected: session?.status === 'WORKING' || session?.status === 'ready', state: session?.status || 'unknown' };
  } catch {
    return { connected: false, state: null };
  }
}

// Get contact info (best-effort — WAHA Core may not resolve all fields)
async function getContact(contactId) {
  try {
    const session = await getSession();
    const sessionKey = session?.name || session?.id;
    const res = await axios.get(
      `${base()}/api/sessions/${sessionKey}/contacts/${encodeURIComponent(contactId)}`,
      { headers: headers(), timeout: 8000 }
    );
    return res.data;
  } catch {
    return null;
  }
}

// Get all individual chats
async function getAllChats() {
  try {
    const session = await getSession();
    if (!session) return [];
    const sessionKey = session.name || session.id;
    const res = await axios.get(
      `${base()}/api/sessions/${sessionKey}/chats`,
      { headers: headers(), timeout: 30000 }
    );
    return Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    console.error('[waha] getAllChats error:', e.message);
    return [];
  }
}

// Get messages for a chat — WAHA Plus persists history per chat
async function getChatMessages(chatId, limit = 500) {
  try {
    const session = await getSession();
    if (!session) return [];
    const sessionKey = session.name || session.id;
    const res = await axios.get(
      `${base()}/api/sessions/${sessionKey}/chats/${encodeURIComponent(chatId)}/messages`,
      { headers: headers(), timeout: 30000, params: { limit } }
    );
    const d = res.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.messages)) return d.messages;
    return [];
  } catch (e) {
    if (e.response?.status !== 404) {
      console.error(`[waha] getChatMessages(${chatId}) error:`, e.message);
    }
    return [];
  }
}

// Configure webhook for the active session (persists in WAHA store)
async function configureWebhook(webhookUrl) {
  try {
    const session = await getSession();
    if (!session) return false;
    const sessionKey = session.name || session.id;
    await axios.put(`${base()}/api/sessions/${sessionKey}`, {
      config: {
        webhooks: [{ url: webhookUrl, events: ['message'], enabled: true }],
      }
    }, { headers: headers(), timeout: 10000 });
    console.log(`[waha] Webhook configured → ${webhookUrl}`);
    return true;
  } catch (e) {
    console.error('[waha] configureWebhook error:', e.message);
    return false;
  }
}

module.exports = { sendText, getStatus, toWaId, fromWaId, getContact, getAllChats, getChatMessages, getSession, resetSession, configureWebhook };
