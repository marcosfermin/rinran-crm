import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Edit2, Check, X, ChevronDown, Camera, Paperclip, File, Music, Download, Zap, Search, UserCheck, GitBranch, CheckCircle, Clock, MessageSquare, Activity, CornerUpLeft } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';
import { Avatar, PhotoLightbox } from '../components/Avatar.jsx';

const STAGES = [
  { key: 'nuevo', label: 'Nuevo' }, { key: 'contactado', label: 'Contactado' },
  { key: 'en_progreso', label: 'En progreso' }, { key: 'propuesta', label: 'Propuesta' },
  { key: 'ganado', label: 'Ganado' }, { key: 'perdido', label: 'Perdido' },
];

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

function MediaContent({ msg, onDownload }) {
  const url = msg.media_url;
  const type = msg.media_type || '';
  const filename = msg.media_filename || 'archivo';
  const [downloading, setDownloading] = useState(false);
  const PLACEHOLDERS = ['[Foto]', '[Video]', '[Audio]', '[Archivo]', '[Sticker]'];
  const isPlaceholder = PLACEHOLDERS.includes(msg.content) && !url;

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

const MEDIA_PLACEHOLDERS = ['[Foto]', '[Video]', '[Audio]', '[Archivo]', '[Sticker]'];

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

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const photoInputRef = useRef(null);
  const fileInputRef = useRef(null);

  function load() {
    apiFetch(`/api/contacts/${id}`).then(r => r?.json()).then(d => {
      if (!d) return;
      setData(d);
      setEditForm({ name: d.name, category_id: d.category_id || '', notes: d.notes || '', pipeline_stage: d.pipeline_stage || 'nuevo', assigned_to: d.assigned_to || '' });
    });
  }

  useEffect(() => {
    load();
    apiFetch('/api/categories').then(r => r?.json()).then(d => d && setCategories(d));
    apiFetch('/api/team').then(r => r?.json()).then(d => d && setTeam(Array.isArray(d) ? d : []));
    apiFetch('/api/templates').then(r => r?.json()).then(d => d && setTemplates(Array.isArray(d) ? d : []));
    apiFetch(`/api/inbox/${id}/read`, { method: 'PATCH' }).catch(() => {});
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
    setSending(true);
    if (attachment) {
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

  async function saveEdit() {
    await apiFetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, category_id: editForm.category_id || null, assigned_to: editForm.assigned_to || null }) });
    setEditing(false); load();
  }

  function useTemplate(t) {
    const text = t.content.replace(/\{\{nombre\}\}/g, data?.name || '');
    setMessage(text); setShowTemplates(false); inputRef.current?.focus();
  }

  const allMessages = useMemo(() => [...(data?.messages || [])].reverse(), [data?.messages]);
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return allMessages;
    const q = searchQuery.toLowerCase();
    return allMessages.filter(m => m.content?.toLowerCase().includes(q));
  }, [allMessages, searchQuery]);

  if (!data) return <div className="flex items-center justify-center h-full text-gray-600"><div className="animate-pulse">Cargando...</div></div>;

  const cat = categories.find(c => c.id === data.category_id);
  const stage = STAGES.find(s => s.key === (data.pipeline_stage || 'nuevo'));
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
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500 truncate">{data.phone}</p>
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
          <div className="flex gap-3 border-b border-gray-800 -mx-4 px-4">
            {[['chat', MessageSquare, 'Info'], ['activity', Activity, 'Actividad']].map(([tab, Icon, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 pb-2 px-1 text-xs font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-green-500 text-green-400' : 'border-transparent text-gray-500 hover:text-white'}`}>
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
                  {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
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
            <div className="flex flex-wrap gap-3 text-sm">
              <div><span className="text-gray-500 text-xs">País</span><p className="text-gray-200">{data.country_flag} {data.country_name}</p></div>
              <div>
                <span className="text-gray-500 text-xs">Categoría</span>
                <p>{cat ? <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: cat.color + '33', color: cat.color }}>{cat.name}</span> : <span className="text-gray-600">—</span>}</p>
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
            {attachment.preview
              ? <img src={attachment.preview} className="w-10 h-10 rounded object-cover shrink-0" />
              : <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center shrink-0">{attachment.type?.startsWith('audio/') ? <Music size={14} /> : <File size={14} />}</div>}
            <div className="flex-1 min-w-0"><p className="text-xs text-white truncate">{attachment.name}</p><p className="text-xs text-gray-500">{formatSize(attachment.size)}</p></div>
            <button onClick={() => setAttachment(null)} className="p-1 text-gray-500 hover:text-white"><X size={15} /></button>
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
          <textarea ref={inputRef} value={message} onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(e); } }}
            placeholder={attachment ? 'Descripción (opcional)...' : replyTo ? 'Responder...' : 'Mensaje...'}
            rows={1}
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
