import { useEffect, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, X } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';

export default function Trash() {
  const [contacts, setContacts] = useState([]);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [selected, setSelected] = useState(new Set());

  function load() {
    apiFetch('/api/trash').then(r => r?.json()).then(d => d && setContacts(Array.isArray(d) ? d : []));
  }

  useEffect(() => { load(); }, []);

  async function restore(id) {
    await apiFetch(`/api/trash/${id}/restore`, { method: 'POST' });
    setSelected(s => { const n = new Set(s); n.delete(id); return n; });
    load();
  }

  async function hardDelete(id) {
    if (!window.confirm('¿Eliminar permanentemente este contacto? No se puede deshacer.')) return;
    await apiFetch(`/api/trash/${id}`, { method: 'DELETE' });
    load();
  }

  async function emptyTrash() {
    await apiFetch('/api/trash', { method: 'DELETE' });
    setConfirmEmpty(false);
    setContacts([]);
  }

  async function restoreSelected() {
    for (const id of selected) await apiFetch(`/api/trash/${id}/restore`, { method: 'POST' });
    setSelected(new Set());
    load();
  }

  function toggleSelect(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trash2 size={20} className="text-red-400" />
          <h1 className="text-xl font-bold text-white">Papelera</h1>
          {contacts.length > 0 && (
            <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full">{contacts.length}</span>
          )}
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button onClick={restoreSelected}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-700 text-green-400 hover:bg-green-500/10 transition-colors">
              <RotateCcw size={12} /> Restaurar ({selected.size})
            </button>
          )}
          {contacts.length > 0 && (
            <button onClick={() => setConfirmEmpty(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-800 text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 size={12} /> Vaciar papelera
            </button>
          )}
        </div>
      </div>

      {confirmEmpty && (
        <div className="bg-red-950/20 border border-red-800 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-white font-medium">¿Vaciar papelera?</p>
            <p className="text-xs text-gray-400 mt-1">Se eliminarán permanentemente {contacts.length} contacto{contacts.length !== 1 ? 's' : ''} y todos sus mensajes. Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setConfirmEmpty(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:bg-gray-800">Cancelar</button>
              <button onClick={emptyTrash}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium">Eliminar todo</button>
            </div>
          </div>
          <button onClick={() => setConfirmEmpty(false)} className="text-gray-600 hover:text-white"><X size={14} /></button>
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-600">
          <Trash2 size={40} className="mb-3 opacity-30" />
          <p className="text-sm">La papelera está vacía</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map(c => (
            <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                className="w-4 h-4 accent-yellow-500 cursor-pointer" />
              <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {(c.name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{c.name}</p>
                <p className="text-xs text-gray-500">{c.phone} · {c.msg_count || 0} mensajes</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => restore(c.id)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-green-800 text-green-400 hover:bg-green-500/10 transition-colors">
                  <RotateCcw size={11} /> Restaurar
                </button>
                <button onClick={() => hardDelete(c.id)}
                  className="p-1.5 text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
