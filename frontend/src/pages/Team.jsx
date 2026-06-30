import { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Team() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');

  function load() {
    apiFetch('/api/team').then(r => r?.json()).then(d => d && setMembers(Array.isArray(d) ? d : []));
  }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    setError('');
    const r = await apiFetch('/api/team', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const d = await r?.json();
    if (!r?.ok) { setError(d?.error || 'Error'); return; }
    setShowAdd(false); setForm({ name: '', email: '', password: '' }); load();
  }

  async function del(id) {
    if (!confirm('¿Eliminar agente?')) return;
    await apiFetch(`/api/team/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-blue-400" />
          <h1 className="text-xl font-bold text-white">Equipo</h1>
        </div>
        <button
          onClick={() => { setShowAdd(true); setError(''); }}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Agregar agente
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Nuevo agente</h2>
          {error && <p className="mb-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
          <form onSubmit={add} className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Email *</label>
              <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Contraseña *</label>
              <div className="relative">
                <input required type={showPwd ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-green-500" />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAdd(false)}
                className="flex-1 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800">
                Cancelar
              </button>
              <button type="submit"
                className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-white text-sm font-medium">
                Agregar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {members.map((m, i) => (
          <div key={m.id} className={`flex items-center gap-3 px-4 py-3.5 ${i < members.length - 1 ? 'border-b border-gray-800' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-white">{m.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white truncate">{m.name}</p>
                {m.id === user?.id && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-900/40 text-green-400 rounded-full">Tú</span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate">{m.email}</p>
            </div>
            <p className="text-xs text-gray-600 hidden md:block shrink-0">
              Desde {new Date(m.created_at).toLocaleDateString('es')}
            </p>
            {m.id !== user?.id && (
              <button onClick={() => del(m.id)}
                className="p-1.5 text-gray-600 hover:text-red-400 transition-colors shrink-0">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
        {!members.length && (
          <p className="text-center text-gray-600 py-10 text-sm">Sin agentes</p>
        )}
      </div>
    </div>
  );
}
