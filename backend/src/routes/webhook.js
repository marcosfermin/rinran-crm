const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');
const { parsePhone } = require('../phoneUtils');
const { fromWaId, sendText, resolveLid, downloadMedia } = require('../whatsapp');
const { broadcast: sseEmit } = require('./sse');
const { fireOutboundWebhooks } = require('../outboundWebhooks');

const uploadsDir = path.join(__dirname, '../../../data/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

router.get('/', (req, res) => {
  res.json({ ok: true, endpoint: 'Rinran CRM webhook active' });
});

router.post('/', async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  const event = body?.event || '';

  // Log all events
  try {
    const db = getDb();
    const payload = JSON.stringify(body).slice(0, 8000);
    db.prepare('INSERT INTO webhook_log (event_type, session, payload) VALUES (?, ?, ?)').run(event || 'unknown', body?.session || '', payload);
    // Keep only last 500 entries
    db.prepare('DELETE FROM webhook_log WHERE id NOT IN (SELECT id FROM webhook_log ORDER BY id DESC LIMIT 500)').run();
  } catch {}

  // Handle delivery/read ACKs
  if (event === 'message.ack' || event === 'message:ack') {
    try {
      const db = getDb();
      const ackData = body?.payload || body?.data || {};
      const waId = ackData.id || ackData.msgId || ackData._serialized;
      const ack = ackData.ack;
      if (waId && ack >= 2) {
        // Update broadcast tracking
        db.prepare("UPDATE broadcast_recipients SET status = 'delivered' WHERE wa_message_id = ? AND status = 'sent'").run(waId);
        // Update individual message status
        db.prepare("UPDATE messages SET status = 'delivered' WHERE wa_message_id = ? AND status = 'sent'").run(waId);
        if (ack >= 3) {
          db.prepare("UPDATE broadcast_recipients SET status = 'read' WHERE wa_message_id = ?").run(waId);
          db.prepare("UPDATE messages SET status = 'read' WHERE wa_message_id = ?").run(waId);
        }
      }
    } catch {}
    return;
  }

  if (!event.includes('message')) return;

  try {
    const db = getDb();
    const msgData = body?.payload || body?.data || {};

    if (msgData.fromMe === true) return;

    const rawFrom = msgData.from || msgData.chatId || msgData.sender?.id || '';
    if (!rawFrom) return;
    if (msgData.isStatusBroadcast === true) return;

    const isGroup = rawFrom.endsWith('@g.us');

    // For group messages, use participant (actual sender) as the contact
    const senderRaw = isGroup ? (msgData.participant || msgData.sender?.id || '') : rawFrom;
    if (!senderRaw) return;
    if (senderRaw.endsWith('@g.us')) return;

    const MEDIA_LABELS = { image: '[Foto]', video: '[Video]', audio: '[Audio]', voice: '[Audio]', ptt: '[Audio]', document: '[Archivo]', sticker: '[Sticker]' };
    const MIME_LABELS = { 'image/': '[Foto]', 'video/': '[Video]', 'audio/': '[Audio]' };
    let text = msgData.body || msgData.content || msgData.text || '';
    if (!text.trim()) {
      if (!msgData.hasMedia) return;
      // WAHA NOWEB often omits `type` — fall back to mimetype prefix
      let label = MEDIA_LABELS[msgData.type];
      if (!label && msgData.media?.mimetype) {
        const mime = msgData.media.mimetype;
        label = Object.entries(MIME_LABELS).find(([k]) => mime.startsWith(k))?.[1];
      }
      text = label || '[Archivo]';
    }

    // LIDs (@lid) are device-internal IDs, not real phone numbers.
    // Resolve them to the actual phone via WAHA before doing any DB lookup.
    let rawPhone = fromWaId(senderRaw);
    if (senderRaw.endsWith('@lid')) {
      const resolved = await resolveLid(senderRaw);
      if (resolved) rawPhone = resolved;
    }
    const parsed = parsePhone(rawPhone);
    const wa_message_id = msgData.id || null;
    const senderName = msgData.notifyName || msgData.pushName
      || msgData._data?.notifyName
      || `WhatsApp ${parsed.phone}`;

    const sessionName = body?.session || '';
    let contact = db.prepare('SELECT * FROM contacts WHERE phone = ?').get(parsed.phone);
    const isNew = !contact;

    if (!contact) {
      const groupNote = isGroup ? `Participante del grupo ${rawFrom.replace('@g.us', '')}` : null;

      // Auto-assignment: fallback to no-category rules (new contacts have no category yet)
      let autoAssignAgent = null;
      try {
        const rules = db.prepare("SELECT * FROM assignment_rules WHERE is_active = 1 AND category_id IS NULL ORDER BY sort_order, id LIMIT 1").all();
        if (rules.length > 0) autoAssignAgent = rules[0].agent_id;
      } catch {}

      const r = db.prepare(`
        INSERT INTO contacts (name, phone, country_code, country_flag, country_name, source, wa_chat_id, wa_session, notes, assigned_to)
        VALUES (?, ?, ?, ?, ?, 'whatsapp', ?, ?, ?, ?)
      `).run(senderName, parsed.phone, parsed.country_code, parsed.country_flag, parsed.country_name,
             isGroup ? senderRaw : rawFrom, sessionName, groupNote, autoAssignAgent || null);
      contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(r.lastInsertRowid);
      console.log(`[webhook] New contact: ${parsed.phone} (${senderName})`);
    } else {
      if (!contact.wa_chat_id) {
        db.prepare('UPDATE contacts SET wa_chat_id = ?, wa_session = ? WHERE id = ?').run(
          isGroup ? senderRaw : rawFrom, sessionName || contact.wa_session, contact.id
        );
      }
      const nameIsPhone = /^\+[\d\s\(\)\-\.]+$/.test(contact.name.trim()) || contact.name.startsWith('WhatsApp ');
      if (nameIsPhone && senderName && !senderName.startsWith('WhatsApp ')) {
        db.prepare("UPDATE contacts SET name = ?, updated_at = datetime('now') WHERE id = ?").run(senderName, contact.id);
      }
    }

    if (wa_message_id) {
      const dup = db.prepare('SELECT id FROM messages WHERE wa_message_id = ?').get(wa_message_id);
      if (dup) return;
    }

    const insertedMsg = db.prepare(`
      INSERT INTO messages (contact_id, direction, content, wa_message_id, status)
      VALUES (?, 'inbound', ?, ?, 'received')
    `).run(contact.id, text, wa_message_id);
    const msgId = insertedMsg.lastInsertRowid;

    // Auto-save media so images/videos render inline instead of as placeholders.
    // With WHATSAPP_DOWNLOAD_MEDIA=TRUE, WAHA includes base64 data in media.data.
    // Fallback: fetch from the media.url WAHA provides (works while WAHA caches the file).
    const mediaInfo = msgData.hasMedia && msgData.media ? msgData.media : null;
    console.log(`[webhook] hasMedia=${msgData.hasMedia} type=${msgData.type} mediaKeys=${mediaInfo ? Object.keys(mediaInfo).join(',') : 'none'} hasData=${!!(mediaInfo?.data)} url=${mediaInfo?.url || 'none'}`);
    if (mediaInfo) {
      setImmediate(async () => {
        try {
          const contentType = mediaInfo.mimetype || 'application/octet-stream';
          const ext = (contentType.split('/')[1] || 'bin').split(';')[0];
          const origName = mediaInfo.filename ? mediaInfo.filename.replace(/[^a-zA-Z0-9._-]/g, '_') : '';
          const filename = `media_${msgId}${origName ? '_' + origName : '.' + ext}`;
          let buf = null;

          // Prefer inline base64 data (available when WHATSAPP_DOWNLOAD_MEDIA=TRUE)
          if (mediaInfo.data) {
            buf = Buffer.from(mediaInfo.data, 'base64');
          } else if (mediaInfo.url) {
            // Fetch from WAHA's temporary file URL
            const axios = require('axios');
            const internalUrl = mediaInfo.url.replace('http://localhost:3000', 'http://waha:3000');
            const wahaHeaders = {};
            if (process.env.OPENWA_API_KEY) wahaHeaders['X-Api-Key'] = process.env.OPENWA_API_KEY;
            const resp = await axios.get(internalUrl, { responseType: 'arraybuffer', timeout: 30000, headers: wahaHeaders });
            buf = Buffer.from(resp.data);
          }

          if (!buf) { console.error('[webhook] media: no data or url'); return; }
          fs.writeFileSync(path.join(uploadsDir, filename), buf);
          const localUrl = `/uploads/${filename}`;
          db.prepare('UPDATE messages SET media_url = ?, media_type = ?, media_filename = ? WHERE id = ?')
            .run(localUrl, contentType, mediaInfo.filename || filename, msgId);
          console.log(`[webhook] media saved: ${filename} (${contentType}, ${buf.length} bytes)`);
        } catch (e) {
          console.error('[webhook] media auto-download failed:', e.message);
        }
      });
    }

    // Update conv_status to 'open' on incoming message
    db.prepare("UPDATE contacts SET conv_status = 'open', updated_at = datetime('now') WHERE id = ? AND conv_status != 'open'").run(contact.id);

    console.log(`[webhook] ✓ ${parsed.phone} (${senderName}): ${text.slice(0, 80)}`);

    // Emit SSE to connected browser clients
    try { sseEmit('message', { contact_id: contact.id, phone: contact.phone, name: contact.name }); } catch {}

    // Fire outbound webhooks for inbound message
    setImmediate(() => fireOutboundWebhooks(db, 'message.inbound', { contact: { id: contact.id, name: contact.name, phone: contact.phone }, message: text }));

    // Auto-reply rules
    setImmediate(() => processAutoReply(db, contact, text, isNew));

  } catch (e) {
    console.error('[webhook] Error:', e.message);
  }
});


function isWithinHours(rangeStr, tz = 'America/New_York') {
  const parts = rangeStr?.split('-');
  if (!parts || parts.length !== 2) return false;
  const [startH, startM] = parts[0].split(':').map(Number);
  const [endH, endM] = parts[1].split(':').map(Number);
  const nowStr = new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const [h, m] = nowStr.split(':').map(Number);
  const nowMin = h * 60 + m;
  const startMin = startH * 60 + (startM || 0);
  const endMin = endH * 60 + (endM || 0);
  return nowMin >= startMin && nowMin < endMin;
}

async function processAutoReply(db, contact, text, isNewContact) {
  try {
    const rules = db.prepare("SELECT * FROM auto_reply_rules WHERE is_active = 1 ORDER BY id").all();
    for (const rule of rules) {
      let matches = false;
      if (rule.trigger_type === 'first_contact' && isNewContact) matches = true;
      if (rule.trigger_type === 'always') matches = true;
      if (rule.trigger_type === 'keyword' && rule.trigger_value) {
        matches = text.toLowerCase().includes(rule.trigger_value.toLowerCase());
      }
      if (rule.trigger_type === 'after_hours' && rule.trigger_value) {
        matches = !isWithinHours(rule.trigger_value);
      }

      if (!matches) continue;

      const response = rule.response
        .replace(/\{\{nombre\}\}/g, contact.name)
        .replace(/\{\{telefono\}\}/g, contact.phone);

      // Rate-limit: don't auto-reply more than once per 10 minutes per contact
      const recent = db.prepare(`
        SELECT id FROM messages WHERE contact_id = ? AND direction = 'outbound'
          AND content = ? AND sent_at > datetime('now', '-10 minutes')
      `).get(contact.id, response);
      if (recent) continue;

      await sendText(contact.phone, response, contact.wa_chat_id);
      db.prepare(`INSERT INTO messages (contact_id, direction, content, status) VALUES (?, 'outbound', ?, 'sent')`).run(contact.id, response);
      break; // Only fire first matching rule
    }
  } catch (e) {
    console.error('[webhook] Auto-reply error:', e.message);
  }
}

module.exports = router;
