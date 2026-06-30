import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Plus, Check, Trash2, Clock, AlertCircle, X } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';

function formatDue(due) {
  const d = new Date(due.replace(' ', 'T') + 'Z');
  const now = new Date();
  const diff = d - now;
  if (diff < 0) return { label: `Hace ${Math.round(-diff / 60000)}m`, overdue: true };
  if (diff < 3600000) return { label: `En ${Math.round(diff / 60000)}m`, overdue: false };
  if (diff < 86400000) return { label: `En ${Math.round(diff / 3600000)}h`, overdue: false };
  return { label: d.toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), overdue: false };
}

export default function Reminders() {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [showDone, setShowDone] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ contact_id: '', title: '', note: '', due_at: '' });

  function load() {
    apiFetch(`/api/reminders?done=${showDone ? 1 : 0}`).then(r => r?.json()).then(d => d && setReminders(Array.isArray(d) ? d : []));
  }

  useEffect(() => { load(); }, [showDone]);

  useEffect(() => {
    apiFetch('/api/contacts?limit=200').then(r => r?.json()).then(d => d && setContacts(d.contacts ?? []));
  }, []);

  async function addReminder(e) {
    e.preventDefault();
    const r = await apiFetch('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (r?.ok) { setShowAdd(false); setForm({ contact_id: '', title: '', note: '', due_at: '' }); load(); }
  }

  async function markDone(id) {
    await apiFetch(`/api/reminders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: true }) });
    load();
  }

  async function del(id) {
    await apiFetch(`/api/reminders/${id}`, { method: 'DELETE' });
    load();
  }

  const overdue = reminders.filter(r => !r.done && new Date(r.due_at.replace(' ', 'T') + 'Z') < new Date());
  const upcoming = reminders.filter(r => !r.done && new Date(r.due_at.replace(' ', 'T') + 'Z') >= new Date());
  const done = reminders.filter(r => r.done);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-yellow-400" />
          <h1 className="text-xl font-bold text-white">Recordatorios</h1>
          {overdue.length > 0 && (
            <span className="bg-red-500/20 text-red-400 border border-red-800 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertCircle size={10} /> {overdue.length} vencido{overdue.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDone(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showDone ? 'border-green-600 text-green-400 bg-green-500/10' : 'border-gray-700 text-gray-400 hover:text-white'}`}>
            {showDone ? 'Ver pendientes' : 'Ver completados'}
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-400 text-black px-3 py-2 rounded-xl text-sm font-medium transition-colors">
            <Plus size={15} /> Nuevo
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-gray-900 border border-yellow-700/40 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Nuevo recordatorio</h2>
            <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white"><X size={16} /></button>
          </div>
          <form onSubmit={addReminder} className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Contacto *</label>
              <select required value={form.contact_id} onChange={e => setForm(f => ({ ...f, contact_id: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500">
                <option value="">Seleccionar contacto...</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Título *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Llamar para seguimiento"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nota</label>
              <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Contexto adicional..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Fecha y hora *</label>
              <input required type="datetime-local" value={form.due_at} onChange={e => setForm(f => ({ ...f, due_at: e.target.value }))}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAdd(false)}
                className="flex-1 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800">Cancelar</button>
              <button type="submit"
                className="flex-1 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-medium">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {!showDone && overdue.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wide">Vencidos</h3>
          {overdue.map(r => <ReminderCard key={r.id} r={r} onDone={markDone} onDelete={del} onNavigate={navigate} />)}
        </div>
      )}

      {!showDone && upcoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Próximos</h3>
          {upcoming.map(r => <ReminderCard key={r.id} r={r} onDone={markDone} onDelete={del} onNavigate={navigate} />)}
        </div>
      )}

      {showDone && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Completados</h3>
          {done.map(r => <ReminderCard key={r.id} r={r} onDone={markDone} onDelete={del} onNavigate={navigate} />)}
        </div>
      )}

      {reminders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-600">
          <Bell size={40} className="mb-3 opacity-30" />
          <p className="text-sm">{showDone ? 'Sin recordatorios completados' : 'Sin recordatorios pendientes'}</p>
        </div>
      )}
    </div>
  );
}

function ReminderCard({ r, onDone, onDelete, onNavigate }) {
  const { label, overdue } = formatDue(r.due_at);
  return (
    <div className={`bg-gray-900 border rounded-xl px-4 py-3 flex items-start gap-3 ${overdue && !r.done ? 'border-red-800/60 bg-red-950/10' : 'border-gray-800'}`}>
      <button onClick={() => !r.done && onDone(r.id)}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${r.done ? 'bg-green-500 border-green-500' : 'border-gray-600 hover:border-yellow-400'}`}>
        {r.done && <Check size={11} className="text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${r.done ? 'line-through text-gray-500' : 'text-white'}`}>{r.title}</p>
        {r.note && <p className="text-xs text-gray-500 mt-0.5">{r.note}</p>}
        <button onClick={() => onNavigate(`/contacts/${r.contact_id}`)}
          className="text-xs text-blue-400 hover:text-blue-300 mt-1">{r.contact_name}</button>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs flex items-center gap-1 ${overdue && !r.done ? 'text-red-400' : 'text-gray-500'}`}>
          <Clock size={10} /> {label}
        </span>
        <button onClick={() => onDelete(r.id)} className="p-1 text-gray-600 hover:text-red-400 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
