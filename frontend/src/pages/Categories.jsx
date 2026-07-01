import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Link2, Tag, Unlink, Download } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';

const COLORS = ['#22c55e','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899','#6b7280'];

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [waLabels, setWaLabels] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', color: '#22c55e' });
  const [editing, setEditing] = useState(null);
  const [linkingId, setLinkingId] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [importing, setImporting] = useState(false);

  function load() {
    apiFetch('/api/categories').then(r => r?.json()).then(d => d && setCategories(Array.isArray(d) ? d : []));
  }

  function loadWaLabels() {
    apiFetch('/api/categories/wa-labels').then(r => r?.json()).then(d => d && setWaLabels(Array.isArray(d) ? d : []));
  }

  useEffect(() => { load(); loadWaLabels(); }, []);

  async function add(e) {
    e.preventDefault();
    await apiFetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowAdd(false);
    setForm({ name: '', color: '#22c55e' });
    load();
  }

  async function save(id) {
    await apiFetch(`/api/categories/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    setEditing(null);
    load();
  }

  async function del(id) {
    if (!confirm('¿Eliminar categoría? Los contactos quedarán sin categoría.')) return;
    await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
    load();
  }

  async function linkLabel(catId, waLabelId) {
    await apiFetch(`/api/categories/${catId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wa_label_id: waLabelId || null }) });
    setLinkingId(null);
    load();
  }

  async function importFromWa() {
    setImporting(true);
    setSyncResult(null);
    const r = await apiFetch('/api/categories/sync-from-wa', { method: 'POST' });
    const d = await r?.json();
    setImporting(false);
    if (d?.ok) {
      setSyncResult({ message: `✓ ${d.categoriesCreated} categorías creadas, ${d.categoriesLinked} vinculadas, ${d.contactsUpdated} contactos actualizados.` });
      load(); loadWaLabels();
    } else {
      setSyncResult({ message: d?.message || 'Error al importar', errors: 1 });
    }
  }

  const linkedCount = categories.filter(c => c.wa_label_id).length;

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Categorías</h1>
          <p className="text-xs text-gray-500 mt-0.5">{linkedCount} de {categories.length} vinculadas a WhatsApp</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={importFromWa} disabled={importing}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Download size={14} className={importing ? 'animate-bounce' : ''} />
            {importing ? 'Importando…' : 'WhatsApp → CRM'}
          </button>
<button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> Nueva
          </button>
        </div>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm border ${syncResult.errors > 0 ? 'bg-yellow-900/20 border-yellow-700 text-yellow-300' : 'bg-green-900/20 border-green-700 text-green-300'}`}>
          <span>
            {syncResult.message
              ? syncResult.message
              : `✓ ${syncResult.synced} contactos sincronizados${syncResult.errors > 0 ? ` · ${syncResult.errors} errores` : ''} de ${syncResult.total} total`}
          </span>
          <button onClick={() => setSyncResult(null)} className="text-gray-400 hover:text-white ml-4"><X size={14} /></button>
        </div>
      )}

      {/* Info banner */}
      {waLabels.length === 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-xs text-gray-400">
          No se encontraron labels de WhatsApp. Verifica que la sesión esté activa y que tengas labels creados en WhatsApp.
        </div>
      )}

      {/* Category cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {categories.map(c => {
          const linkedLabel = waLabels.find(l => String(l.id) === String(c.wa_label_id));
          return (
            <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              {/* Name + actions */}
              {editing?.id === c.id ? (
                <div className="space-y-3">
                  <input value={editing.name} onChange={e => setEditing(ed => ({ ...ed, name: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none" />
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map(col => (
                      <button key={col} onClick={() => setEditing(ed => ({ ...ed, color: col }))}
                        className={`w-6 h-6 rounded-full border-2 ${editing.color === col ? 'border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: col }} />
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
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
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

              {/* WA Label linking */}
              <div className="border-t border-gray-800 pt-2.5">
                {linkingId === c.id ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">Selecciona el label de WhatsApp:</p>
                    <select defaultValue={c.wa_label_id || ''}
                      onChange={e => linkLabel(c.id, e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-green-500">
                      <option value="">— Sin vincular —</option>
                      {waLabels.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <button onClick={() => setLinkingId(null)} className="text-xs text-gray-500 hover:text-gray-300">Cancelar</button>
                  </div>
                ) : linkedLabel ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag size={11} className="text-green-400 shrink-0" />
                      <span className="text-xs text-green-300">WA: {linkedLabel.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setLinkingId(c.id)} className="text-xs text-gray-500 hover:text-white flex items-center gap-1">
                        <Link2 size={11} /> Cambiar
                      </button>
                      <button onClick={() => linkLabel(c.id, null)} className="text-xs text-gray-600 hover:text-red-400 ml-1">
                        <Unlink size={11} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setLinkingId(c.id)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-green-400 transition-colors w-full">
                    <Link2 size={11} />
                    Vincular a label de WhatsApp
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add modal */}
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
                      style={{ backgroundColor: col }} />
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
