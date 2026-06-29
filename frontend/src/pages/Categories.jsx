import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';

const COLORS = ['#22c55e','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899','#6b7280'];

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', color: '#22c55e' });
  const [editing, setEditing] = useState(null);

  function load() {
    apiFetch('/api/categories').then(r => r?.json()).then(d => d && setCategories(Array.isArray(d) ? d : []));
  }

  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    await apiFetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowAdd(false);
    setForm({ name: '', color: '#22c55e' });
    load();
  }

  async function save(id) {
    await apiFetch(`/api/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    setEditing(null);
    load();
  }

  async function del(id) {
    if (!confirm('¿Eliminar categoría? Los contactos quedarán sin categoría.')) return;
    await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Categorías</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nueva
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {categories.map(c => (
          <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            {editing?.id === c.id ? (
              <div className="space-y-3">
                <input
                  value={editing.name}
                  onChange={e => setEditing(ed => ({ ...ed, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
                />
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(col => (
                    <button
                      key={col}
                      onClick={() => setEditing(ed => ({ ...ed, color: col }))}
                      className={`w-6 h-6 rounded-full border-2 ${editing.color === col ? 'border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => save(c.id)} className="flex items-center gap-1 text-green-400 text-xs hover:text-green-300"><Check size={13} /> Guardar</button>
                  <button onClick={() => setEditing(null)} className="flex items-center gap-1 text-gray-400 text-xs hover:text-gray-300"><X size={13} /> Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <div>
                    <p className="text-sm font-medium text-white">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.contact_count} contactos</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing({ id: c.id, name: c.name, color: c.color })} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => del(c.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-white mb-4">Nueva categoría</h2>
            <form onSubmit={add} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nombre *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(col => (
                    <button key={col} type="button" onClick={() => setForm(f => ({ ...f, color: col }))}
                      className={`w-7 h-7 rounded-full border-2 ${form.color === col ? 'border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800">Cancelar</button>
                <button type="submit" className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-white text-sm font-medium">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
