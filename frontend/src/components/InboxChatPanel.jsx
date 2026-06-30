import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, ExternalLink, File, Paperclip, Music, Download, Zap, CornerUpLeft, X, Mic, MicOff, MapPin, Check, CheckCircle, MessageSquare } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';
import { Avatar } from './Avatar.jsx';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const MEDIA_PLACEHOLDERS = ['[Foto]', '[Video]', '[Audio]', '[Archivo]', '[Sticker]'];

function MediaContent({ msg, onDownload }) {
  const url = msg.media_url;
  const type = msg.media_type || '';
  const filename = msg.media_filename || 'archivo';
  const [downloading, setDownloading] = useState(false);
  const isPlaceholder = MEDIA_PLACEHOLDERS.includes(msg.content) && !url;

  if (isPlaceholder && msg.wa_message_id) {
    const emojis = { '[Foto]': '🖼️', '[Video]': '🎬', '[Audio]': '🎵', '[Archivo]': '📎', '[Sticker]': '🎨' };
    return (
      <div className="flex items-center gap-2 mb-1 bg-white/10 rounded-lg px-3 py-2">
        <span>{emojis[msg.content] || '📎'}</span>
        <span className="text-xs flex-1 text-gray-300">{msg.content.replace(/[\[\]]/g, '')}</span>
        <button onClick={async () => { if (downloading) return; setDownloading(true); await onDownload(msg.id); setDownloading(false); }}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
          {downloading ? <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" /> : <Download size={12} />}
          Ver
        </button>
      </div>
    );
  }
  if (!url) return null;
  if (type.startsWith('image/')) return <a href={url} target="_blank" rel="noreferrer" className="block mb-1"><img src={url} alt={filename} className="rounded-lg max-w-full max-h-60 object-cover" /></a>;
  if (type.startsWith('video/')) return <video controls src={url} className="rounded-lg max-w-full mb-1" style={{ maxHeight: 240 }} />;
  if (type.startsWith('audio/')) return <audio controls src={url} className="w-full mb-1" />;
  return (
    <a href={url} download={filename} className="flex items-center gap-2 mb-1 bg-white/10 rounded-lg px-3 py-2 hover:bg-white/20 transition-colors">
      <File size={18} className="shrink-0" /><span className="text-sm truncate flex-1">{filename}</span><Download size={14} className="shrink-0 opacity-70" />
    </a>
  );
}

function MessageBubble({ msg, onDownload, onReply }) {
  const isOut = msg.direction === 'outbound';
  const time = new Date(msg.sent_at.replace(' ', 'T') + 'Z').toLocaleString('es', { hour: '2-digit', minute: '2-digit' });
  const isPlaceholder = MEDIA_PLACEHOLDERS.includes(msg.content) && !msg.media_url;
  const showText = msg.content && msg.content !== msg.media_filename && !isPlaceholder;
  return (
    <div className={`flex group ${isOut ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
        isOut ? 'bg-green-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-100 rounded-bl-sm'
      }`}>
        {msg.reply_to_content && (
          <div className={`text-xs border-l-2 pl-2 mb-1.5 py-0.5 rounded ${isOut ? 'border-green-300 text-green-200 bg-green-700/50' : 'border-gray-600 text-gray-400 bg-gray-700/50'}`}>
            <p className="truncate">{msg.reply_to_content}</p>
          </div>
        )}
        {(msg.media_url || isPlaceholder) && <MediaContent msg={msg} onDownload={onDownload} />}
        {showText && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
        <div className="flex items-center justify-between gap-2 mt-1">
          <button onClick={() => onReply(msg)}
            className={`opacity-0 group-hover:opacity-100 transition-opacity text-[10px] flex items-center gap-0.5 ${isOut ? 'text-green-200 hover:text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <CornerUpLeft size={10} /> Citar
          </button>
          <p className={`text-[11px] text-right ${isOut ? 'text-green-200' : 'text-gray-500'}`}>
            {time}{isOut && msg.status === 'failed' ? ' ✗' : isOut ? ' ✓' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function InboxChatPanel({ contactId, onClose }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const [sendingLocation, setSendingLocation] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const typingTimerRef = useRef(null);

  function load() {
    apiFetch(`/api/contacts/${contactId}`).then(r => r?.json()).then(d => {
      if (d) setData(d);
    });
  }

  useEffect(() => {
    setData(null);
    setMessage('');
    setAttachment(null);
    setReplyTo(null);
    load();
    apiFetch('/api/templates').then(r => r?.json()).then(d => d && setTemplates(Array.isArray(d) ? d : []));
    apiFetch(`/api/inbox/${contactId}/read`, { method: 'PATCH' }).catch(() => {});
    apiFetch('/api/messages/send-seen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: parseInt(contactId) }) }).catch(() => {});
  }, [contactId]);

  useEffect(() => {
    const t = setInterval(() => {
      apiFetch(`/api/contacts/${contactId}`).then(r => r?.json()).then(d => d && setData(d));
      apiFetch(`/api/inbox/${contactId}/read`, { method: 'PATCH' }).catch(() => {});
    }, 6000);
    return () => clearInterval(t);
  }, [contactId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages?.length]);

  const allMessages = useMemo(() => [...(data?.messages || [])].reverse(), [data?.messages]);

  async function downloadMedia(msgId) {
    const r = await apiFetch(`/api/messages/${msgId}/download-media`, { method: 'POST' });
    if (r?.ok) load();
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      setAttachment({ name: file.name, type: file.type, size: file.size, data: dataUrl.split(',')[1], preview: file.type.startsWith('image/') ? dataUrl : null });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleTypingInput(value) {
    setMessage(value);
    clearTimeout(typingTimerRef.current);
    if (value.trim()) {
      apiFetch('/api/messages/typing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: parseInt(contactId), active: true }) }).catch(() => {});
      typingTimerRef.current = setTimeout(() => {
        apiFetch('/api/messages/typing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: parseInt(contactId), active: false }) }).catch(() => {});
      }, 3000);
    } else {
      apiFetch('/api/messages/typing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: parseInt(contactId), active: false }) }).catch(() => {});
    }
  }

  function stopTyping() {
    clearTimeout(typingTimerRef.current);
    apiFetch('/api/messages/typing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: parseInt(contactId), active: false }) }).catch(() => {});
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' : 'audio/mp4';
        const mr = new MediaRecorder(stream, { mimeType: mime });
        audioChunksRef.current = [];
        mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mr.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          clearInterval(recordingTimerRef.current);
          setRecording(false); setRecordingSecs(0);
          const blob = new Blob(audioChunksRef.current, { type: mime });
          const reader = new FileReader();
          reader.onload = ev => {
            const b64 = ev.target.result.split(',')[1];
            setAttachment({ name: `nota_voz_${Date.now()}.ogg`, type: mime, size: blob.size, data: b64, isVoice: true });
          };
          reader.readAsDataURL(blob);
        };
        mr.start(250);
        mediaRecorderRef.current = mr;
        setRecording(true); setRecordingSecs(0);
        recordingTimerRef.current = setInterval(() => setRecordingSecs(s => s + 1), 1000);
      } catch (e) { alert('Micrófono no disponible: ' + e.message); }
    }
  }

  function cancelRecording() {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {};
      mediaRecorderRef.current?.stop();
    }
    clearInterval(recordingTimerRef.current);
    setRecording(false); setRecordingSecs(0);
  }

  async function shareLocation() {
    if (!navigator.geolocation) return alert('Geolocalización no disponible.');
    setSendingLocation(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      await apiFetch('/api/messages/send-location', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: parseInt(contactId), latitude, longitude }),
      });
      setSendingLocation(false); load();
    }, err => { setSendingLocation(false); alert('No se pudo obtener ubicación: ' + err.message); });
  }

  async function sendMsg(e) {
    e.preventDefault();
    if ((!message.trim() && !attachment) || sending) return;
    stopTyping();
    setSending(true);
    if (attachment?.isVoice) {
      await apiFetch('/api/messages/send-voice', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: parseInt(contactId), data: attachment.data, mimetype: attachment.type }) });
      setAttachment(null);
    } else if (attachment) {
      await apiFetch('/api/messages/send-file', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: parseInt(contactId), data: attachment.data, filename: attachment.name, mimetype: attachment.type, caption: message.trim() || undefined }) });
      setAttachment(null);
    } else {
      await apiFetch('/api/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: parseInt(contactId), message: message.trim(), reply_to_id: replyTo?.id || undefined }) });
    }
    setMessage(''); setReplyTo(null); setSending(false);
    load(); inputRef.current?.focus();
  }

  function useTemplate(t) {
    const text = t.content.replace(/\{\{nombre\}\}/g, data?.name || '');
    setMessage(text); setShowTemplates(false); inputRef.current?.focus();
  }

  if (!contactId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-700 bg-gray-950">
        <MessageSquare size={40} className="mb-3 opacity-20" />
        <p className="text-sm">Selecciona una conversación</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-3 py-3 flex items-center gap-2 shrink-0">
        <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white p-1 -ml-1">
          <ArrowLeft size={20} />
        </button>
        {data && <Avatar contact={data} size="sm" />}
        {!data && <div className="w-9 h-9 rounded-full bg-gray-800 animate-pulse shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{data?.name || '…'}</p>
          <p className="text-xs text-gray-500 truncate">{data?.phone}</p>
        </div>
        <button onClick={() => navigate(`/contacts/${contactId}`)}
          title="Ver perfil completo"
          className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
          <ExternalLink size={15} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-2">
        {!data && (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="animate-pulse text-sm">Cargando…</div>
          </div>
        )}
        {data && allMessages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-700 text-sm">Sin mensajes</div>
        )}
        {allMessages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} onDownload={downloadMedia} onReply={setReplyTo} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Templates */}
      {showTemplates && templates.length > 0 && (
        <div className="bg-gray-900 border-t border-gray-800 max-h-40 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
            <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5"><Zap size={12} /> Plantillas</span>
            <button onClick={() => setShowTemplates(false)} className="text-gray-600 hover:text-white"><X size={14} /></button>
          </div>
          {templates.map(t => (
            <button key={t.id} onClick={() => useTemplate(t)}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-800 border-b border-gray-800/50 transition-colors">
              <p className="text-xs font-semibold text-yellow-400 mb-0.5">{t.name}</p>
              <p className="text-xs text-gray-400 truncate">{t.content}</p>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="bg-gray-900 border-t border-gray-800 shrink-0">
        {replyTo && (
          <div className="flex items-center gap-2 px-3 pt-2 bg-gray-800/50 border-b border-gray-700">
            <CornerUpLeft size={13} className="text-blue-400 shrink-0" />
            <p className="text-xs text-gray-400 flex-1 truncate">{replyTo.content}</p>
            <button onClick={() => setReplyTo(null)} className="p-1 text-gray-500 hover:text-white"><X size={12} /></button>
          </div>
        )}
        {attachment && (
          <div className="px-3 pt-2.5 flex items-center gap-2">
            {attachment.isVoice
              ? <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-700 flex items-center justify-center shrink-0"><Mic size={14} className="text-green-400" /></div>
              : attachment.preview
                ? <img src={attachment.preview} className="w-10 h-10 rounded object-cover shrink-0" alt="" />
                : <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center shrink-0">{attachment.type?.startsWith('audio/') ? <Music size={14} /> : <File size={14} />}</div>}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white truncate">{attachment.isVoice ? 'Nota de voz' : attachment.name}</p>
              <p className="text-xs text-gray-500">{formatSize(attachment.size)}</p>
            </div>
            <button onClick={() => setAttachment(null)} className="p-1 text-gray-500 hover:text-white"><X size={15} /></button>
          </div>
        )}
        {recording && (
          <div className="px-3 pt-2 flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 bg-red-900/20 border border-red-800 rounded-xl px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-xs text-red-400 font-mono">{String(Math.floor(recordingSecs/60)).padStart(2,'0')}:{String(recordingSecs%60).padStart(2,'0')}</span>
              <span className="text-xs text-red-300 flex-1">Grabando…</span>
            </div>
            <button type="button" onClick={cancelRecording} className="p-2 text-gray-500 hover:text-red-400"><X size={16} /></button>
          </div>
        )}
        <form onSubmit={sendMsg} className="px-3 py-3 flex gap-2 items-end pb-safe">
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-full transition-colors shrink-0">
            <Paperclip size={18} />
          </button>
          <input ref={fileInputRef} type="file" accept="*/*" className="hidden" onChange={handleFileSelect} />
          {templates.length > 0 && (
            <button type="button" onClick={() => setShowTemplates(v => !v)}
              className={`p-2.5 rounded-full transition-colors shrink-0 ${showTemplates ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-500 hover:text-yellow-400 hover:bg-gray-800'}`}>
              <Zap size={18} />
            </button>
          )}
          <button type="button" onClick={shareLocation} disabled={sendingLocation}
            className="p-2.5 text-gray-500 hover:text-blue-400 hover:bg-gray-800 rounded-full transition-colors shrink-0 disabled:opacity-40">
            {sendingLocation ? <div className="w-4 h-4 border border-blue-400 border-t-transparent rounded-full animate-spin" /> : <MapPin size={18} />}
          </button>
          {!attachment && !message.trim() && (
            <button type="button" onClick={toggleRecording}
              className={`p-2.5 rounded-full transition-colors shrink-0 ${recording ? 'text-red-400 bg-red-400/10' : 'text-gray-500 hover:text-green-400 hover:bg-gray-800'}`}>
              {recording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <textarea ref={inputRef} value={message} onChange={e => handleTypingInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(e); } }}
            placeholder={attachment?.isVoice ? 'Nota lista para enviar' : attachment ? 'Descripción (opcional)…' : replyTo ? 'Responder…' : 'Mensaje…'}
            rows={1}
            readOnly={!!attachment?.isVoice}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500 resize-none max-h-32 leading-5"
            style={{ minHeight: '42px' }}
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'; }}
          />
          <button type="submit" disabled={sending || (!message.trim() && !attachment)}
            className="bg-green-500 hover:bg-green-400 active:bg-green-600 disabled:opacity-40 text-white p-2.5 rounded-full transition-colors shrink-0">
            {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}
