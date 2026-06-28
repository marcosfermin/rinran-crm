import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Edit2, Check, X } from 'lucide-react';

function MessageBubble({ msg }) {
  const isOut = msg.direction === 'outbound';
  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
        isOut ? 'bg-green-600 text-white rounded-br-sm' : 'bg-gray-700 text-gray-100 rounded-bl-sm'
      }`}>
        <p>{msg.content}</p>
        <p className={`text-xs mt-1 ${isOut ? 'text-green-200' : 'text-gray-400'}`}>
          {new Date(msg.sent_at).toLocaleString('es', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
          {isOut && ` · ${msg.status}`}
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

  function load() {
    fetch(`/api/contacts/${id}`).then(r => r.json()).then(d => {
      setData(d);
      setEditForm({ name: d.name, category_id: d.category_id || '', notes: d.notes || '' });
    });
  }

  useEffect(() => {
    load();
    fetch('/api/categories').then(r => r.json()).then(setCategories);
  }, [id]);

  async function sendMsg(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: parseInt(id), message }),
    });
    setMessage('');
    setSending(false);
    load();
  }

  async function saveEdit() {
    await fetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditing(false);
    load();
  }

  if (!data) return <div className="p-6 text-gray-500">Cargando...</div>;

  const cat = categories.find(c => c.id === data.category_id);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/contacts')} className="text-gray-400 hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <div className="text-3xl">{data.country_flag || '🏳️'}</div>
        <div className="flex-1">
          {editing ? (
            <input
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-lg font-bold w-full focus:outline-none"
            />
          ) : (
            <h2 className="text-lg font-bold text-white">{data.name}</h2>
          )}
          <p className="text-sm text-gray-400 font-mono">{data.phone} · {data.country_name}</p>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={saveEdit} className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg"><Check size={16} /></button>
            <button onClick={() => setEditing(false)} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg"><X size={16} /></button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
            <Edit2 size={16} />
          </button>
        )}
      </div>

      {/* Info bar */}
      <div className="bg-gray-900/50 border-b border-gray-800 px-6 py-2 flex items-center gap-4 text-sm">
        <div>
          <span className="text-gray-500">Categoría: </span>
          {editing ? (
            <select
              value={editForm.category_id}
              onChange={e => setEditForm(f => ({ ...f, category_id: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-white text-xs ml-1 focus:outline-none"
            >
              <option value="">Sin categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : cat ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium ml-1" style={{ backgroundColor: cat.color + '33', color: cat.color }}>
              {cat.name}
            </span>
          ) : <span className="text-gray-600 ml-1">—</span>}
        </div>
        <div className="text-gray-500">
          Fuente: <span className="text-gray-300">{data.source}</span>
        </div>
        <div className="text-gray-500">
          Desde: <span className="text-gray-300">{new Date(data.created_at).toLocaleDateString('es')}</span>
        </div>
      </div>

      {editing && (
        <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/30">
          <label className="text-xs text-gray-400">Notas</label>
          <textarea
            value={editForm.notes}
            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none resize-none"
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4 space-y-3">
        {data.messages?.length === 0 && (
          <div className="text-center text-gray-600 mt-10">Sin mensajes aún</div>
        )}
        {[...(data.messages || [])].reverse().map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
      </div>

      {/* Send */}
      <form onSubmit={sendMsg} className="bg-gray-900 border-t border-gray-800 px-6 py-4 flex gap-3">
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Escribir mensaje..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500"
        />
        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg transition-colors"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
