import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Edit2, Check, X, ChevronDown, Camera, Paperclip, File, Music, Download, Zap, Search, UserCheck, GitBranch, CheckCircle, Clock, MessageSquare, Activity, CornerUpLeft, StickyNote, Plus, Trash2, Tag, Bell, Mic, MicOff, MapPin, Phone, Play, Pause } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';
import { Avatar, PhotoLightbox } from '../components/Avatar.jsx';


const CONV_STATUS = [
  { key: 'open', label: 'Abierto', icon: MessageSquare, color: 'text-green-400' },
  { key: 'pending', label: 'Pendiente', icon: Clock, color: 'text-yellow-400' },
  { key: 'closed', label: 'Cerrado', icon: CheckCircle, color: 'text-gray-500' },
];

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function AudioPlayer({ src, isOutbound }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);

  function fmt(s) {
    if (!isFinite(s) || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  function toggle() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); }
    else { audioRef.current.play().catch(() => {}); }
  }

  function seek(e) {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0;
  const base = isOutbound ? 'bg-green-700/40' : 'bg-gray-700/50';
  const bar  = isOutbound ? 'bg-white/80' : 'bg-green-400';
  const track= isOutbound ? 'bg-white/20' : 'bg-gray-600';

  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 min-w-[200px] max-w-[280px] mb-1 ${base}`}>
      <audio ref={audioRef} src={src} preload="metadata"
        onLoadedMetadata={e => { setDuration(e.target.duration); setLoaded(true); }}
        onTimeUpdate={e => setCurrent(e.target.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); if (audioRef.current) audioRef.current.currentTime = 0; }}
      />
      <button onClick={toggle}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${isOutbound ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'}`}>
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>
      <div className="flex-1 min-w-0 space-y-1">
        <div className={`h-1.5 rounded-full cursor-pointer ${track}`} onClick={seek}>
          <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
        </div>
        <p className={`text-[10px] ${isOutbound ? 'text-white/60' : 'text-gray-500'}`}>
          {loaded ? fmt(playing ? current : duration) : '…'}
        </p>
      </div>
      <Mic size={12} className={isOutbound ? 'text-white/40 shrink-0' : 'text-gray-600 shrink-0'} />
    </div>
  );
}

function MediaContent({ msg, onDownload, isOutbound }) {
  const url = msg.media_url;
  const type = msg.media_type || '';
  const filename = msg.media_filename || 'archivo';
  const [downloading, setDownloading] = useState(false);
  const PLACEHOLDERS = ['[Foto]', '[Video]', '[Audio]', '[Archivo]', '[Sticker]'];
  const isPlaceholder = PLACEHOLDERS.includes(msg.content) && !url;

  if (isPlaceholder && msg.wa_message_id) {
    const emojis = { '[Foto]': '🖼️', '[Video]': '🎬', '[Audio]': '🎵', '[Archivo]': '📎', '[Sticker]': '🎨' };
    const isAudioPlaceholder = msg.content === '[Audio]';
    return (
      <div className="flex items-center gap-2 mb-1 bg-white/10 rounded-lg px-3 py-2 min-w-[180px]">
        <span>{emojis[msg.content] || '📎'}</span>
        <span className="text-xs flex-1 text-gray-300">{isAudioPlaceholder ? 'Nota de voz' : msg.content.replace(/[\[\]]/g, '')}</span>
        <button onClick={async () => { if (downloading) return; setDownloading(true); await onDownload(msg.id); setDownloading(false); }}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
          {downloading ? <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" /> : <Play size={12} />}
          {isAudioPlaceholder ? 'Cargar' : 'Ver'}
        </button>
      </div>
    );
  }
  if (!url) return null;
  if (type.startsWith('image/')) return <a href={url} target="_blank" rel="noreferrer" className="block mb-1"><img src={url} alt={filename} className="rounded-lg max-w-full max-h-60 object-cover" /></a>;
  if (type.startsWith('video/')) return <video controls src={url} className="rounded-lg max-w-full mb-1" style={{ maxHeight: 240 }} />;
  if (type.startsWith('audio/')) return <AudioPlayer src={url} isOutbound={isOutbound} />;
  return (
    <a href={url} download={filename} className="flex items-center gap-2 mb-1 bg-white/10 rounded-lg px-3 py-2 hover:bg-white/20 transition-colors">
      <File size={18} className="shrink-0" /><span className="text-sm truncate flex-1">{filename}</span><Download size={14} className="shrink-0 opacity-70" />
    </a>
  );
}

const MEDIA_PLACEHOLDERS = ['[Foto]', '[Video]', '[Audio]', '[Archivo]', '[Sticker]'];

function MessageBubble({ msg, onDownload, onReply }) {
  const isOut = msg.direction === 'outbound';
  const time = new Date(msg.sent_at.replace(' ', 'T') + 'Z').toLocaleString('es', { hour: '2-digit', minute: '2-digit' });
  const isPlaceholder = MEDIA_PLACEHOLDERS.includes(msg.content) && !msg.media_url;
  const showText = msg.content && msg.content !== msg.media_filename && !MEDIA_PLACEHOLDERS.includes(msg.content);
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
        {(msg.media_url || isPlaceholder) && <MediaContent msg={msg} onDownload={onDownload} isOutbound={isOut} />}
        {showText && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
        <div className="flex items-center justify-between gap-2 mt-1">
          <button onClick={() => onReply(msg)}
            className={`opacity-0 group-hover:opacity-100 transition-opacity text-[10px] flex items-center gap-0.5 ${isOut ? 'text-green-200 hover:text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <CornerUpLeft size={10} /> Citar
          </button>
          <p className={`text-[11px] text-right ${isOut ? 'text-green-200' : 'text-gray-500'}`}>
            {time}
            {isOut && (
              msg.status === 'failed' ? <span className="text-red-300 ml-0.5">✗</span> :
              msg.status === 'read' ? <span className="text-blue-300 ml-0.5">✓✓</span> :
              msg.status === 'delivered' ? <span className="opacity-60 ml-0.5">✓✓</span> :
              <span className="opacity-60 ml-0.5">✓</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showCatMenu, setShowCatMenu] = useState(false);
  const [team, setTeam] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showInfo, setShowInfo] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [showLightbox, setShowLightbox] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [reminders, setReminders] = useState([]);
  const [reminderForm, setReminderForm] = useState({ title: '', note: '', due_at: '', wa_message: '' });
  const [showReminderAdd, setShowReminderAdd] = useState(false);
  const [editReminderId, setEditReminderId] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const [stages, setStages] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [customFieldEdits, setCustomFieldEdits] = useState({});
  const [savingFields, setSavingFields] = useState(false);
  // WAHA features
  const [recording, setRecording] = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const [numberStatus, setNumberStatus] = useState(null); // null | 'checking' | { exists, phone }
  const [sendingLocation, setSendingLocation] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const photoInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const typingTimerRef = useRef(null);

  function load() {
    apiFetch(`/api/contacts/${id}`).then(r => r?.json()).then(d => {
      if (!d) return;
      setData(d);
      setEditForm({ name: d.name, category_id: d.category_id || '', notes: d.notes || '', pipeline_stage: d.pipeline_stage || 'nuevo', assigned_to: d.assigned_to || '' });
      if (d.customFields) {
        setCustomFields(d.customFields);
        const edits = {};
        d.customFields.forEach(f => { edits[f.field_def_id] = f.value || ''; });
        setCustomFieldEdits(edits);
      }
    });
  }

  function loadNotes() {
    apiFetch(`/api/contacts/${id}/notes`).then(r => r?.json()).then(d => d && setNotes(Array.isArray(d) ? d : []));
  }

  function loadReminders() {
    apiFetch(`/api/reminders?contact_id=${id}`).then(r => r?.json()).then(d => d && setReminders(Array.isArray(d) ? d : []));
  }

  function localToUtc(dtLocal) {
    if (!dtLocal) return '';
    return new Date(dtLocal).toISOString().replace('T', ' ').slice(0, 19);
  }
  function utcToLocal(dtUtc) {
    if (!dtUtc) return '';
    const d = new Date(dtUtc.replace(' ', 'T') + 'Z');
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  async function addReminder(e) {
    e.preventDefault();
    const payload = { ...reminderForm, due_at: localToUtc(reminderForm.due_at), contact_id: id };
    if (editReminderId) {
      await apiFetch(`/api/reminders/${editReminderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: payload.title, note: payload.note, due_at: payload.due_at, wa_message: payload.wa_message || null }) });
    } else {
      await apiFetch('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setShowReminderAdd(false); setEditReminderId(null); setReminderForm({ title: '', note: '', due_at: '', wa_message: '' }); loadReminders();
  }

  async function markReminderDone(rid) {
    await apiFetch(`/api/reminders/${rid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: true }) });
    loadReminders();
  }

  useEffect(() => {
    load();
    loadNotes();
    loadReminders();
    apiFetch('/api/categories').then(r => r?.json()).then(d => d && setCategories(d));
    apiFetch('/api/team').then(r => r?.json()).then(d => d && setTeam(Array.isArray(d) ? d : []));
    apiFetch('/api/templates').then(r => r?.json()).then(d => d && setTemplates(Array.isArray(d) ? d : []));
    apiFetch('/api/tags').then(r => r?.json()).then(d => d && setAllTags(Array.isArray(d) ? d : []));
    apiFetch('/api/pipeline-stages').then(r => r?.json()).then(d => d && setStages(Array.isArray(d) ? d : []));
    apiFetch(`/api/inbox/${id}/read`, { method: 'PATCH' }).catch(() => {});
    apiFetch('/api/messages/send-seen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: parseInt(id) }) }).catch(() => {});
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => {
      apiFetch(`/api/contacts/${id}`).then(r => r?.json()).then(d => d && setData(d));
      apiFetch(`/api/inbox/${id}/read`, { method: 'PATCH' }).catch(() => {});
    }, 6000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => {
    if (!showSearch) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages?.length]);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setAttachment({ name: file.name, type: file.type, size: file.size, data: dataUrl.split(',')[1], preview: file.type.startsWith('image/') ? dataUrl : null });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function sendMsg(e) {
    e.preventDefault();
    if ((!message.trim() && !attachment) || sending) return;
    stopTyping();
    setSending(true);
    if (attachment?.isVoice) {
      if (attachment.blobUrl) URL.revokeObjectURL(attachment.blobUrl);
      await apiFetch('/api/messages/send-voice', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: parseInt(id), data: attachment.data, mimetype: attachment.type }) });
      setAttachment(null);
    } else if (attachment) {
      await apiFetch('/api/messages/send-file', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: parseInt(id), data: attachment.data, filename: attachment.name, mimetype: attachment.type, caption: message.trim() || undefined }) });
      setAttachment(null);
    } else {
      await apiFetch('/api/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: parseInt(id), message: message.trim(), reply_to_id: replyTo?.id || undefined }) });
    }
    setMessage(''); setReplyTo(null); setSending(false);
    load(); inputRef.current?.focus();
  }

  async function downloadMedia(msgId) {
    const r = await apiFetch(`/api/messages/${msgId}/download-media`, { method: 'POST' });
    if (r?.ok) load();
  }

  async function uploadPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const res = await apiFetch(`/api/contacts/${id}/photo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: ev.target.result }) });
      if (res?.ok) load();
      setUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function setConvStatus(status) {
    await apiFetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conv_status: status }) });
    load();
  }

  async function addNote() {
    if (!noteText.trim()) return;
    await apiFetch(`/api/contacts/${id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: noteText.trim() }) });
    setNoteText(''); loadNotes();
  }

  async function deleteNote(noteId) {
    await apiFetch(`/api/contacts/${id}/notes/${noteId}`, { method: 'DELETE' });
    setNotes(prev => prev.filter(n => n.id !== noteId));
  }

  async function toggleTag(tagId) {
    const has = data?.tags?.some(t => t.id === tagId);
    if (has) {
      await apiFetch(`/api/tags/contact/${id}/${tagId}`, { method: 'DELETE' });
    } else {
      await apiFetch(`/api/tags/contact/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag_id: tagId }) });
    }
    load();
  }

  async function saveCustomFields() {
    setSavingFields(true);
    const values = Object.entries(customFieldEdits).map(([field_def_id, value]) => ({ field_def_id: parseInt(field_def_id), value }));
    await apiFetch(`/api/tags/contact/${id}/custom-fields`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values }) });
    setSavingFields(false);
    load();
  }

  function exportChat() {
    window.location.href = `/api/contacts/${id}/export-chat`;
  }

  async function saveEdit() {
    await apiFetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, category_id: editForm.category_id || null, assigned_to: editForm.assigned_to || null }) });
    setEditing(false); load();
  }

  function useTemplate(t) {
    const text = t.content.replace(/\{\{nombre\}\}/g, data?.name || '');
    setMessage(text); setShowTemplates(false); inputRef.current?.focus();
  }

  // Typing indicator — debounced, fire on input change
  function handleTypingInput(value) {
    setMessage(value);
    clearTimeout(typingTimerRef.current);
    if (value.trim()) {
      apiFetch('/api/messages/typing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: parseInt(id), active: true }) }).catch(() => {});
      typingTimerRef.current = setTimeout(() => {
        apiFetch('/api/messages/typing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: parseInt(id), active: false }) }).catch(() => {});
      }, 3000);
    } else {
      apiFetch('/api/messages/typing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: parseInt(id), active: false }) }).catch(() => {});
    }
  }

  function stopTyping() {
    clearTimeout(typingTimerRef.current);
    apiFetch('/api/messages/typing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: parseInt(id), active: false }) }).catch(() => {});
  }

  // Voice recording
  async function toggleRecording() {
    if (recording) {
      // stop
      mediaRecorderRef.current?.stop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/mp4';
        const mr = new MediaRecorder(stream, { mimeType: mime });
        audioChunksRef.current = [];
        mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mr.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          clearInterval(recordingTimerRef.current);
          setRecording(false); setRecordingSecs(0);
          const blob = new Blob(audioChunksRef.current, { type: mime });
          const blobUrl = URL.createObjectURL(blob);
          const reader = new FileReader();
          reader.onload = ev => {
            const b64 = ev.target.result.split(',')[1];
            setAttachment({ name: `nota_voz_${Date.now()}.ogg`, type: mime, size: blob.size, data: b64, isVoice: true, blobUrl });
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

  // Location sharing
  async function shareLocation() {
    if (!navigator.geolocation) return alert('Geolocalización no disponible en este navegador.');
    setSendingLocation(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      await apiFetch('/api/messages/send-location', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: parseInt(id), latitude, longitude }),
      });
      setSendingLocation(false); load();
    }, err => { setSendingLocation(false); alert('No se pudo obtener ubicación: ' + err.message); });
  }

  // Check WhatsApp number
  async function checkWhatsApp() {
    if (!data?.phone) return;
    setNumberStatus('checking');
    const r = await apiFetch(`/api/wa/check-number?phone=${encodeURIComponent(data.phone)}`);
    const d = await r?.json();
    setNumberStatus(d?.numberExists != null ? { exists: d.numberExists, phone: data.phone } : { exists: false, phone: data.phone });
    setTimeout(() => setNumberStatus(null), 6000);
  }

  const allMessages = useMemo(() => [...(data?.messages || [])].reverse(), [data?.messages]);

  // Auto-download media placeholders with no local URL
  useEffect(() => {
    const pending = allMessages.filter(
      m => !m.media_url && m.wa_message_id && ['[Foto]', '[Video]', '[Archivo]', '[Sticker]'].includes(m.content)
    );
    if (!pending.length) return;
    let changed = false;
    Promise.all(pending.map(m =>
      apiFetch(`/api/messages/${m.id}/download-media`, { method: 'POST' })
        .then(r => { if (r?.ok) changed = true; })
        .catch(() => {})
    )).then(() => { if (changed) load(); });
  }, [allMessages.length]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return allMessages;
    const q = searchQuery.toLowerCase();
    return allMessages.filter(m => m.content?.toLowerCase().includes(q));
  }, [allMessages, searchQuery]);

  async function assignCategory(categoryId) {
    setShowCatMenu(false);
    await apiFetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId || null }),
    });
    load();
  }

  if (!data) return <div className="flex items-center justify-center h-full text-gray-600"><div className="animate-pulse">Cargando...</div></div>;

  const cat = categories.find(c => c.id === data.category_id);
  const stage = stages.find(s => s.key === (data.pipeline_stage || stages[0]?.key));
  const convStatus = CONV_STATUS.find(s => s.key === (data.conv_status || 'open')) || CONV_STATUS[0];
  const ConvIcon = convStatus.icon;

  return (
    <div className="flex flex-col h-screen md:h-full">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-3 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white p-1 -ml-1"><ArrowLeft size={20} /></button>

        <div className="relative shrink-0 group">
          <Avatar contact={data} size="sm" onClick={() => setShowLightbox(true)} />
          <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}
            className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploadingPhoto ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera size={14} className="text-white" />}
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
        </div>

        <button onClick={() => setShowInfo(v => !v)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{data.name}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <a href={`tel:${data.phone}`} onClick={e => e.stopPropagation()} title="Llamar"
                className="text-gray-500 hover:text-blue-400 transition-colors">
                <Phone size={12} />
              </a>
              <button onClick={e => { e.stopPropagation(); checkWhatsApp(); }} title="Verificar WhatsApp"
                className={`text-xs flex items-center gap-1 transition-colors ${
                  numberStatus === 'checking' ? 'text-gray-500' :
                  numberStatus?.exists ? 'text-green-400' :
                  numberStatus?.exists === false ? 'text-red-400' :
                  'text-gray-500 hover:text-green-400'
                }`}>
                <span className="truncate max-w-[110px]">{data.phone}</span>
                {numberStatus === 'checking' && <span className="text-[10px]">…</span>}
                {numberStatus?.exists === true && <CheckCircle size={9} />}
                {numberStatus?.exists === false && <X size={9} />}
              </button>
              {stage && <span className="text-[10px] text-gray-600 flex items-center gap-0.5"><GitBranch size={9} />{stage.label}</span>}
            </div>
          </div>
          <ChevronDown size={14} className={`text-gray-500 shrink-0 transition-transform ${showInfo ? 'rotate-180' : ''}`} />
        </button>

        <div className="flex gap-0.5 shrink-0 items-center">
          {/* Conv status dropdown */}
          <div className="relative group/status">
            <button className={`p-2 rounded-lg ${convStatus.color}`} title={`Estado: ${convStatus.label}`}><ConvIcon size={15} /></button>
            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-xl z-20 min-w-[140px] hidden group-hover/status:block">
              {CONV_STATUS.map(s => (
                <button key={s.key} onClick={() => setConvStatus(s.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-gray-700 ${s.color} ${data.conv_status === s.key ? 'bg-gray-700/50' : ''}`}>
                  <s.icon size={14} /> {s.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setShowSearch(v => !v)}
            className={`p-2 rounded-lg transition-colors ${showSearch ? 'text-green-400 bg-green-500/10' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
            <Search size={16} />
          </button>
          {editing ? (
            <>
              <button onClick={saveEdit} className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg"><Check size={16} /></button>
              <button onClick={() => setEditing(false)} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg"><X size={16} /></button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg"><Edit2 size={16} /></button>
          )}
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="bg-gray-900 border-b border-gray-800 px-3 py-2 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar en la conversación..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            {searchQuery && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{filteredMessages.length}</span>}
          </div>
        </div>
      )}

      {/* Info / edit panel */}
      {showInfo && (
        <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-3 space-y-3 shrink-0">
          <div className="flex gap-3 border-b border-gray-800 -mx-4 px-4 overflow-x-auto">
            {[['chat', MessageSquare, 'Info'], ['notes', StickyNote, 'Notas'], ['reminders', Bell, 'Recordatorios'], ['broadcasts', Send, 'Broadcasts'], ['activity', Activity, 'Actividad']].map(([tab, Icon, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 pb-2 px-1 text-xs font-medium border-b-2 transition-colors shrink-0 ${activeTab === tab ? 'border-green-500 text-green-400' : 'border-transparent text-gray-500 hover:text-white'}`}>
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          {activeTab === 'activity' ? (
            <div className="max-h-48 overflow-y-auto space-y-2">
              {!(data.activity?.length)
                ? <p className="text-xs text-gray-600">Sin actividad registrada</p>
                : data.activity.map(a => (
                  <div key={a.id} className="flex items-start gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 mt-1 shrink-0" />
                    <div className="flex-1"><span className="text-gray-300">{a.detail || a.action}</span>{a.user_name && <span className="text-gray-600"> · {a.user_name}</span>}</div>
                    <span className="text-gray-600 shrink-0">{new Date(a.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('es')}</span>
                  </div>
                ))}
            </div>
          ) : activeTab === 'notes' ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()}
                  placeholder="Nueva nota interna..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500" />
                <button onClick={addNote} className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-xs"><Plus size={13} /></button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {!notes.length ? <p className="text-xs text-gray-600">Sin notas internas</p> : notes.map(n => (
                  <div key={n.id} className="bg-yellow-900/10 border border-yellow-800/30 rounded-lg px-3 py-2 flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-yellow-200">{n.content}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{n.user_name} · {new Date(n.created_at.replace(' ', 'T') + 'Z').toLocaleString('es')}</p>
                    </div>
                    <button onClick={() => deleteNote(n.id)} className="p-0.5 text-gray-600 hover:text-red-400 transition-colors shrink-0"><Trash2 size={11} /></button>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'reminders' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{reminders.filter(r => !r.done).length} pendiente(s)</p>
                <button onClick={() => { setShowReminderAdd(v => !v); setEditReminderId(null); setReminderForm({ title: '', note: '', due_at: '', wa_message: '' }); }}
                  className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300">
                  <Plus size={12} /> Nuevo
                </button>
              </div>
              {showReminderAdd && (
                <form onSubmit={addReminder} className="space-y-2 bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-yellow-400 font-medium">{editReminderId ? 'Editar recordatorio' : 'Nuevo recordatorio'}</p>
                  <input required value={reminderForm.title} onChange={e => setReminderForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Título del recordatorio"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500" />
                  <input value={reminderForm.note || ''} onChange={e => setReminderForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="Nota (opcional)"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500" />
                  <input type="datetime-local" required value={reminderForm.due_at}
                    onChange={e => setReminderForm(f => ({ ...f, due_at: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500" />
                  <textarea value={reminderForm.wa_message || ''} onChange={e => setReminderForm(f => ({ ...f, wa_message: e.target.value }))} rows={2}
                    placeholder="Mensaje WA al contacto (opcional) — {{nombre}}, {{titulo}}"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500 resize-none" />
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => { setShowReminderAdd(false); setEditReminderId(null); }}
                      className="flex-1 py-1.5 rounded border border-gray-600 text-xs text-gray-400">Cancelar</button>
                    <button type="submit"
                      className="flex-1 py-1.5 rounded bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-medium">{editReminderId ? 'Guardar cambios' : 'Guardar'}</button>
                  </div>
                </form>
              )}
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {!reminders.length ? <p className="text-xs text-gray-600">Sin recordatorios</p> : reminders.map(r => {
                  const due = new Date(r.due_at.replace(' ', 'T') + 'Z');
                  const overdue = !r.done && due < new Date();
                  return (
                    <div key={r.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${overdue ? 'border-red-800/50 bg-red-950/10' : 'border-gray-700 bg-gray-800/50'}`}>
                      <button onClick={() => !r.done && markReminderDone(r.id)}
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${r.done ? 'bg-green-500 border-green-500' : 'border-gray-500 hover:border-yellow-400'}`}>
                        {r.done && <Check size={9} className="text-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={r.done ? 'line-through text-gray-500' : 'text-white'}>{r.title}</p>
                        <p className={`text-[10px] ${overdue ? 'text-red-400' : 'text-gray-500'}`}>
                          {due.toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {!r.done && (
                        <button onClick={() => { setEditReminderId(r.id); setReminderForm({ title: r.title, note: r.note || '', due_at: utcToLocal(r.due_at), wa_message: r.wa_message || '' }); setShowReminderAdd(true); }}
                          className="p-1 text-gray-600 hover:text-yellow-400 shrink-0">
                          <Edit2 size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeTab === 'broadcasts' ? (
            <div className="max-h-48 overflow-y-auto space-y-2">
              {!(data.broadcasts?.length)
                ? <p className="text-xs text-gray-600">Este contacto no ha recibido broadcasts</p>
                : data.broadcasts.map(b => {
                  const statusColors = { sent: 'text-gray-400', delivered: 'text-blue-400', read: 'text-green-400', failed: 'text-red-400', pending: 'text-yellow-400' };
                  const statusLabels = { sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'Fallido', pending: 'Pendiente' };
                  return (
                    <div key={b.id} className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{b.name}</p>
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{b.message?.slice(0, 80)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[10px] font-medium ${statusColors[b.recipient_status] || 'text-gray-500'}`}>{statusLabels[b.recipient_status] || b.recipient_status}</p>
                        <p className="text-[10px] text-gray-600">{b.created_at ? new Date(b.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('es') : ''}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : editing ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
                <select value={editForm.category_id} onChange={e => setEditForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Pipeline</label>
                <select value={editForm.pipeline_stage} onChange={e => setEditForm(f => ({ ...f, pipeline_stage: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
                  {stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              {team.length > 0 && (
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Asignado a</label>
                  <select value={editForm.assigned_to} onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
                    <option value="">Sin asignar</option>
                    {team.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Notas</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 resize-none" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 text-sm">
                <div><span className="text-gray-500 text-xs">País</span><p className="text-gray-200">{data.country_flag} {data.country_name}</p></div>
                <div className="relative">
                  <span className="text-gray-500 text-xs">Categoría</span>
                  <p>
                    <button onClick={() => setShowCatMenu(v => !v)}
                      className="mt-0.5 flex items-center gap-1 hover:opacity-80 transition-opacity">
                      {cat
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: cat.color + '33', color: cat.color }}>{cat.name}</span>
                        : <span className="text-gray-500 text-xs flex items-center gap-1"><Tag size={10} /> Asignar</span>}
                    </button>
                  </p>
                  {showCatMenu && (
                    <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-30 min-w-[140px] overflow-hidden">
                      <button onClick={() => assignCategory(null)} className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-700">Sin categoría</button>
                      {categories.map(c => (
                        <button key={c.id} onClick={() => assignCategory(c.id)}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-700 flex items-center gap-2 ${data.category_id === c.id ? 'bg-gray-700/50' : ''}`}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                          <span style={{ color: c.color }}>{c.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div><span className="text-gray-500 text-xs">Pipeline</span><p className="text-gray-200">{stage?.label || '—'}</p></div>
                <div>
                  <span className="text-gray-500 text-xs">Estado</span>
                  <p className={`flex items-center gap-1 text-xs ${convStatus.color}`}><ConvIcon size={11} /> {convStatus.label}</p>
                </div>
                {data.assigned_name && <div><span className="text-gray-500 text-xs">Agente</span><p className="text-gray-200 flex items-center gap-1"><UserCheck size={12} />{data.assigned_name}</p></div>}
                <div><span className="text-gray-500 text-xs">Fuente</span><p className="text-gray-200">{data.source}</p></div>
                {data.notes && <div className="w-full"><span className="text-gray-500 text-xs">Notas</span><p className="text-gray-300 text-sm mt-0.5">{data.notes}</p></div>}
              </div>

              {/* Tags */}
              {allTags.length > 0 && (
                <div>
                  <span className="text-gray-500 text-xs flex items-center gap-1 mb-1.5"><Tag size={10} /> Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map(t => {
                      const active = data.tags?.some(dt => dt.id === t.id);
                      return (
                        <button key={t.id} onClick={() => toggleTag(t.id)}
                          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors font-medium ${active ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
                          style={{ backgroundColor: active ? t.color + '22' : 'transparent', color: t.color, borderColor: t.color + '66' }}>
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Custom fields */}
              {customFields.length > 0 && (
                <div>
                  <span className="text-gray-500 text-xs mb-1.5 block">Campos personalizados</span>
                  <div className="space-y-1.5">
                    {customFields.map(f => {
                      const selectOpts = f.field_type === 'select' && f.options_json
                        ? (() => { try { return JSON.parse(f.options_json); } catch { return []; } })()
                        : null;
                      return (
                        <div key={f.field_def_id} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-24 shrink-0 truncate">{f.name}</span>
                          {selectOpts ? (
                            <select
                              value={customFieldEdits[f.field_def_id] ?? ''}
                              onChange={e => setCustomFieldEdits(prev => ({ ...prev, [f.field_def_id]: e.target.value }))}
                              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-green-500">
                              <option value="">— Elegir —</option>
                              {selectOpts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : (
                            <input
                              type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : f.field_type === 'url' ? 'url' : 'text'}
                              value={customFieldEdits[f.field_def_id] ?? ''}
                              onChange={e => setCustomFieldEdits(prev => ({ ...prev, [f.field_def_id]: e.target.value }))}
                              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-green-500"
                              placeholder={`Valor de ${f.name}...`}
                            />
                          )}
                        </div>
                      );
                    })}
                    <button onClick={saveCustomFields} disabled={savingFields}
                      className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 mt-1">
                      <Check size={11} /> {savingFields ? 'Guardando...' : 'Guardar campos'}
                    </button>
                  </div>
                </div>
              )}

              {/* Export chat */}
              <button onClick={exportChat}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors">
                <Download size={12} /> Exportar chat (.txt)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-2 bg-gray-950">
        {filteredMessages.length === 0 && <div className="flex flex-col items-center justify-center h-full text-gray-700"><p className="text-sm">{searchQuery ? 'Sin resultados' : 'Sin mensajes aún'}</p></div>}
        {filteredMessages.map(msg => <MessageBubble key={msg.id} msg={msg} onDownload={downloadMedia} onReply={setReplyTo} />)}
        <div ref={messagesEndRef} />
      </div>

      {showLightbox && <PhotoLightbox contact={data} onClose={() => setShowLightbox(false)} />}

      {/* Templates picker */}
      {showTemplates && templates.length > 0 && (
        <div className="bg-gray-900 border-t border-gray-800 max-h-48 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
            <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5"><Zap size={12} /> Respuestas rápidas</span>
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
              ? <div className="flex-1 flex items-center gap-2 min-w-0">
                  <AudioPlayer src={attachment.blobUrl} isOutbound={true} />
                </div>
              : <>
                  {attachment.preview
                    ? <img src={attachment.preview} className="w-10 h-10 rounded object-cover shrink-0" />
                    : <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center shrink-0">{attachment.type?.startsWith('audio/') ? <Music size={14} /> : <File size={14} />}</div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{attachment.name}</p>
                    <p className="text-xs text-gray-500">{formatSize(attachment.size)}</p>
                  </div>
                </>}
            <button onClick={() => { if (attachment.blobUrl) URL.revokeObjectURL(attachment.blobUrl); setAttachment(null); }} className="p-1 text-gray-500 hover:text-white"><X size={15} /></button>
          </div>
        )}
        {/* Recording indicator */}
        {recording && (
          <div className="px-3 pt-2 flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 bg-red-900/20 border border-red-800 rounded-xl px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-xs text-red-400 font-mono">{String(Math.floor(recordingSecs/60)).padStart(2,'0')}:{String(recordingSecs%60).padStart(2,'0')}</span>
              <span className="text-xs text-red-300 flex-1">Grabando nota de voz…</span>
            </div>
            <button type="button" onClick={cancelRecording} className="p-2 text-gray-500 hover:text-red-400">
              <X size={16} />
            </button>
          </div>
        )}
        <form onSubmit={sendMsg} className="px-3 py-3 flex gap-2 items-end">
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-full transition-colors shrink-0"><Paperclip size={18} /></button>
          <input ref={fileInputRef} type="file" accept="*/*" className="hidden" onChange={handleFileSelect} />
          {templates.length > 0 && (
            <button type="button" onClick={() => setShowTemplates(v => !v)}
              className={`p-2.5 rounded-full transition-colors shrink-0 ${showTemplates ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-500 hover:text-yellow-400 hover:bg-gray-800'}`}>
              <Zap size={18} />
            </button>
          )}
          <button type="button" onClick={shareLocation} disabled={sendingLocation}
            title="Compartir ubicación"
            className="p-2.5 text-gray-500 hover:text-blue-400 hover:bg-gray-800 rounded-full transition-colors shrink-0 disabled:opacity-40">
            {sendingLocation ? <div className="w-4 h-4 border border-blue-400 border-t-transparent rounded-full animate-spin" /> : <MapPin size={18} />}
          </button>
          {!attachment && !message.trim() ? (
            <button type="button" onClick={toggleRecording}
              title={recording ? 'Detener grabación' : 'Grabar nota de voz'}
              className={`p-2.5 rounded-full transition-colors shrink-0 ${recording ? 'text-red-400 bg-red-400/10' : 'text-gray-500 hover:text-green-400 hover:bg-gray-800'}`}>
              {recording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          ) : null}
          <textarea ref={inputRef} value={message} onChange={e => handleTypingInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(e); } }}
            placeholder={attachment?.isVoice ? 'Nota de voz lista para enviar' : attachment ? 'Descripción (opcional)...' : replyTo ? 'Responder...' : 'Mensaje...'}
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
