import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Edit2, Check, X, ChevronDown, Camera } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';
import { Avatar, PhotoLightbox } from '../components/Avatar.jsx';

function MessageBubble({ msg }) {
  const isOut = msg.direction === 'outbound';
  const time = new Date(msg.sent_at.replace(' ', 'T') + 'Z')
    .toLocaleString('es', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
        isOut
          ? 'bg-green-600 text-white rounded-br-sm'
          : 'bg-gray-800 text-gray-100 rounded-bl-sm'
      }`}>
        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        <p className={`text-[11px] mt-1 text-right ${isOut ? 'text-green-200' : 'text-gray-500'}`}>
          {time}{isOut && msg.status === 'failed' ? ' · ✗' : isOut ? ' ✓' : ''}
        </p>
      </div>
    </div>
  );
}

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showInfo, setShowInfo] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const photoInputRef = useRef(null);

  function load() {
    apiFetch(`/api/contacts/${id}`).then(r => r?.json()).then(d => {
      if (!d) return;
      setData(d);
      setEditForm({ name: d.name, category_id: d.category_id || '', notes: d.notes || '' });
    });
  }

  useEffect(() => {
    load();
    apiFetch('/api/categories').then(r => r?.json()).then(data => data && setCategories(data));
    apiFetch(`/api/inbox/${id}/read`, { method: 'PATCH' }).catch(() => {});
  }, [id]);

  // Poll for new messages every 6 seconds
  useEffect(() => {
    const t = setInterval(() => {
      apiFetch(`/api/contacts/${id}`).then(r => r?.json()).then(d => d && setData(d));
      apiFetch(`/api/inbox/${id}/read`, { method: 'PATCH' }).catch(() => {});
    }, 6000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages?.length]);

  async function sendMsg(e) {
    e.preventDefault();
    if (!message.trim() || sending) return;
    const text = message.trim();
    setMessage('');
    setSending(true);
    await apiFetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: parseInt(id), message: text }),
    });
    setSending(false);
    load();
    inputRef.current?.focus();
  }

  async function uploadPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const res = await apiFetch(`/api/contacts/${id}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: ev.target.result }),
      });
      if (res?.ok) load();
      setUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function saveEdit() {
    await apiFetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditing(false);
    load();
  }

  if (!data) return (
    <div className="flex items-center justify-center h-full text-gray-600">
      <div className="animate-pulse">Cargando...</div>
    </div>
  );

  const cat = categories.find(c => c.id === data.category_id);
  const messages = [...(data.messages || [])].reverse();

  return (
    <div className="flex flex-col h-screen md:h-full">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-3 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white p-1 -ml-1"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="relative shrink-0 group">
          <Avatar
            contact={data}
            size="sm"
            onClick={() => setShowLightbox(true)}
          />
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Cambiar foto"
          >
            {uploadingPhoto
              ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Camera size={14} className="text-white" />}
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
        </div>

        <button
          onClick={() => setShowInfo(v => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{data.name}</p>
            <p className="text-xs text-gray-500 truncate">{data.phone}</p>
          </div>
          <ChevronDown
            size={14}
            className={`text-gray-500 shrink-0 transition-transform ${showInfo ? 'rotate-180' : ''}`}
          />
        </button>

        {editing ? (
          <div className="flex gap-1 shrink-0">
            <button onClick={saveEdit} className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg">
              <Check size={16} />
            </button>
            <button onClick={() => setEditing(false)} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg">
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg shrink-0"
          >
            <Edit2 size={16} />
          </button>
        )}
      </div>

      {/* Collapsible info / edit panel */}
      {showInfo && (
        <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-3 space-y-3 shrink-0">
          {editing ? (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
                <input
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
                <select
                  value={editForm.category_id}
                  onChange={e => setEditForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                >
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notas</label>
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 resize-none"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-3 text-sm">
              <div>
                <span className="text-gray-500 text-xs">País</span>
                <p className="text-gray-200">{data.country_flag} {data.country_name}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Categoría</span>
                <p>
                  {cat
                    ? <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: cat.color + '33', color: cat.color }}>{cat.name}</span>
                    : <span className="text-gray-600">—</span>
                  }
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Fuente</span>
                <p className="text-gray-200">{data.source}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Desde</span>
                <p className="text-gray-200">{new Date(data.created_at).toLocaleDateString('es')}</p>
              </div>
              {data.notes && (
                <div className="w-full">
                  <span className="text-gray-500 text-xs">Notas</span>
                  <p className="text-gray-300 text-sm mt-0.5">{data.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-2 bg-gray-950">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-700">
            <p className="text-sm">Sin mensajes aún</p>
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        <div ref={messagesEndRef} />
      </div>

      {showLightbox && (
        <PhotoLightbox contact={data} onClose={() => setShowLightbox(false)} />
      )}

      {/* Input */}
      <form
        onSubmit={sendMsg}
        className="bg-gray-900 border-t border-gray-800 px-3 py-3 flex gap-2 items-end shrink-0"
      >
        <textarea
          ref={inputRef}
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(e); }
          }}
          placeholder="Mensaje..."
          rows={1}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500 resize-none max-h-32 leading-5"
          style={{ minHeight: '42px' }}
          onInput={e => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
          }}
        />
        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="bg-green-500 hover:bg-green-400 active:bg-green-600 disabled:opacity-40 text-white p-2.5 rounded-full transition-colors shrink-0"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
