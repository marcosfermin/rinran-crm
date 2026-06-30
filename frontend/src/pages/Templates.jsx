import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Zap } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', content: '' });

  function load() {
    apiFetch('/api/templates').then(r => r?.json()).then(d => d && setTemplates(Array.isArray(d) ? d : []));
  }
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    if (editing) {
      await apiFetch(`/api/templates/${editing.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
    } else {
      await apiFetch('/api/templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
    }
    setShowAdd(false); setEditing(null); setForm({ name: '', content: '' }); load();
  }

  function startEdit(t) {
    setEditing(t); setForm({ name: t.name, content: t.content }); setShowAdd(true);
  }

  async function del(id) {
    if (!confirm('¿Eliminar plantilla?')) return;
    await apiFetch(`/api/templates/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-yellow-400" />
          <h1 className="text-xl font-bold text-white">Respuestas rápidas</h1>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditing(null); setForm({ name: '', content: '' }); }}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nueva plantilla
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Las respuestas rápidas aparecen en el chat con el botón <Zap size={12} className="inline" /> para enviarlas con un clic.
        Usá <code className="bg-gray-800 px-1 rounded text-yellow-300">{'{{nombre}}'}</code> para insertar el nombre del contacto.
      </p>

      {showAdd && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">{editing ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
          <form onSubmit={save} className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre *</label>
              <input
                required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Saludo de bienvenida"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Contenido *</label>
              <textarea
                required value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={4}
                placeholder={'Hola {{nombre}}! Gracias por contactarnos. ¿En qué podemos ayudarte?'}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 resize-none"
              />
              <p className="text-xs text-gray-600 mt-1">{form.content.length} caracteres</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowAdd(false); setEditing(null); }}
                className="flex-1 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800">
                Cancelar
              </button>
              <button type="submit"
                className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-white text-sm font-medium">
                {editing ? 'Guardar cambios' : 'Crear plantilla'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {templates.map(t => (
          <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <Zap size={14} className="text-yellow-400 shrink-0" />
                  <span className="text-sm font-semibold text-white truncate">{t.name}</span>
                </div>
                <p className="text-sm text-gray-400 whitespace-pre-wrap">{t.content}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => startEdit(t)}
                  className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                  <Pencil size={14} />
                </button>
                <button onClick={() => del(t.id)}
                  className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {!templates.length && !showAdd && (
          <div className="text-center py-12 text-gray-600">
            <Zap size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin plantillas aún</p>
            <p className="text-xs mt-1">Crea respuestas predefinidas para responder más rápido</p>
          </div>
        )}
      </div>
    </div>
  );
}
