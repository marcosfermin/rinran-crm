const axios = require('axios');

const base = () => process.env.EVOLUTION_URL?.replace(/\/$/, '');

function headers() {
  const key = process.env.EVOLUTION_API_KEY;
  const h = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (key) h['apikey'] = key;
  return h;
}

// Cache the active Evolution instance name
let _instance = null;
async function getInstance() {
  if (_instance) return _instance;
  const name = process.env.EVOLUTION_INSTANCE;
  if (name) { _instance = name; return _instance; }
  const res = await axios.get(`${base()}/instance/fetchInstances`, { headers: headers(), timeout: 10000 });
  const list = Array.isArray(res.data) ? res.data : [];
  const active = list.find(i => (i.instance?.state || i.connectionStatus) === 'open') || list[0];
  _instance = active?.instance?.instanceName || active?.instanceName || null;
  return _instance;
}

// Reset cached instance (call after disconnect/reconnect)
function resetInstance() { _instance = null; }

// Phone ↔ WhatsApp ID helpers
function toWaId(phone) {
  return phone.replace(/^\+/, '').replace(/\D/g, '');
}

function fromWaId(remoteJid) {
  return '+' + remoteJid
    .replace(/@s\.whatsapp\.net$/, '')
    .replace(/@c\.us$/, '')
    .replace(/@g\.us$/, '')
    .replace(/@lid$/, '')
    .replace(/\D/g, '');
}

// Send a text message via Evolution API
async function sendText(phone, text, waChatId) {
  const instance = await getInstance();
  // Evolution API expects bare number (no @suffix)
  const number = waChatId
    ? waChatId.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '').replace(/@lid$/, '')
    : toWaId(phone);
  const res = await axios.post(`${base()}/message/sendText/${instance}`,
    { number, text },
    { headers: headers() }
  );
  return res.data;
}

// Get connection state
async function getStatus() {
  try {
    const instance = await getInstance().catch(() => null);
    if (!instance) return { connected: false, state: 'no_instance' };
    const res = await axios.get(`${base()}/instance/connectionState/${instance}`, {
      headers: headers(), timeout: 5000
    });
    const state = res.data?.instance?.state || res.data?.state;
    return { connected: state === 'open', state: state || 'unknown' };
  } catch {
    return { connected: false, state: null };
  }
}

// Get contact info (to resolve phone numbers)
async function getContact(remoteJid) {
  try {
    const instance = await getInstance();
    const res = await axios.get(`${base()}/contact/findContacts/${instance}`, {
      headers: headers(), timeout: 8000,
      params: { where: JSON.stringify({ remoteJid }) },
    });
    const list = Array.isArray(res.data) ? res.data : [];
    return list[0] || null;
  } catch {
    return null;
  }
}

// Get all chats — normalizes to { id, name, isGroup }
async function getAllChats() {
  try {
    const instance = await getInstance();
    if (!instance) return [];
    const res = await axios.post(`${base()}/chat/findChats/${instance}`, {}, {
      headers: headers(), timeout: 30000
    });
    const data = Array.isArray(res.data) ? res.data : [];
    return data.map(c => ({
      id: c.remoteJid || c.id,
      name: c.name || c.pushName || '',
      isGroup: (c.remoteJid || c.id || '').endsWith('@g.us'),
    }));
  } catch (e) {
    console.error('[evolution] getAllChats error:', e.message);
    return [];
  }
}

// Get messages for a chat — Evolution persists them in PostgreSQL
async function getChatMessages(chatId, limit = 500) {
  try {
    const instance = await getInstance();
    if (!instance) return [];
    const res = await axios.post(`${base()}/chat/findMessages/${instance}`, {
      where: { key: { remoteJid: chatId } },
      limit,
    }, { headers: headers(), timeout: 30000 });
    const d = res.data;
    // Evolution wraps in { messages: { records: [...] } } or { messages: [...] }
    return d?.messages?.records || d?.messages || (Array.isArray(d) ? d : []);
  } catch (e) {
    if (e.response?.status !== 404) {
      console.error(`[evolution] getChatMessages(${chatId}) error:`, e.message);
    }
    return [];
  }
}

// Configure Evolution API to send webhooks to this CRM
async function configureWebhook(webhookUrl) {
  try {
    const instance = await getInstance();
    if (!instance) return false;
    await axios.post(`${base()}/webhook/set/${instance}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
      }
    }, { headers: headers(), timeout: 10000 });
    console.log(`[evolution] Webhook configured → ${webhookUrl}`);
    return true;
  } catch (e) {
    console.error('[evolution] configureWebhook error:', e.message);
    return false;
  }
}

module.exports = {
  sendText, getStatus, toWaId, fromWaId, getContact,
  getAllChats, getChatMessages, getInstance, resetInstance, configureWebhook,
  // alias for backward compat with any code that calls getSession
  getSession: getInstance,
};
