import { useEffect, useState } from 'react';
import { BookOpen, Copy, Check, Plus, Trash2, Edit2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  }
  return (
    <button onClick={copy} className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-400 transition-colors shrink-0">
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

function EditModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({ title: item?.title || '', emoji: item?.emoji || '', content: item?.content || '' });
  const isChecklist = item?.category === 'do' || item?.category === 'dont';
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Editar</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          {!isChecklist && (
            <div className="flex gap-2">
              <div className="w-16">
                <label className="text-xs text-gray-400 mb-1 block">Emoji</label>
                <input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} maxLength={4}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white text-center focus:outline-none focus:border-green-500" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">Título</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
              </div>
            </div>
          )}
          {isChecklist && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Texto</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
          )}
          {!isChecklist && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Contenido</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 resize-none" />
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800">Cancelar</button>
          <button onClick={() => onSave(form)} className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-white text-sm font-medium">Guardar</button>
        </div>
      </div>
    </div>
  );
}

function AddModal({ category, onSave, onClose }) {
  const isChecklist = category === 'do' || category === 'dont';
  const [form, setForm] = useState({ title: '', emoji: '', content: '' });
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Nuevo ítem</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          {!isChecklist && (
            <div className="flex gap-2">
              <div className="w-16">
                <label className="text-xs text-gray-400 mb-1 block">Emoji</label>
                <input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} maxLength={4}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white text-center focus:outline-none focus:border-green-500" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">Título</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
              </div>
            </div>
          )}
          {isChecklist && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Texto</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
          )}
          {!isChecklist && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Contenido</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 resize-none" />
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800">Cancelar</button>
          <button onClick={() => onSave(form)} disabled={!form.title.trim()} className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white text-sm font-medium">Agregar</button>
        </div>
      </div>
    </div>
  );
}

function ScriptCard({ item, onEdit, onDelete }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white">{item.title}</p>
        <div className="flex gap-1 shrink-0">
          <CopyButton text={item.content} />
          <button onClick={() => onEdit(item)} className="p-1 text-gray-600 hover:text-yellow-400"><Edit2 size={13} /></button>
          <button onClick={() => onDelete(item.id)} className="p-1 text-gray-600 hover:text-red-400"><Trash2 size={13} /></button>
        </div>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{item.content}</p>
    </div>
  );
}

function ObjectionCard({ item, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/50 transition-colors">
        {item.emoji && <span className="text-lg shrink-0">{item.emoji}</span>}
        <span className="flex-1 text-sm font-medium text-white">{item.title}</span>
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); onEdit(item); }} className="p-1 text-gray-600 hover:text-yellow-400"><Edit2 size={13} /></button>
          <button onClick={e => { e.stopPropagation(); onDelete(item.id); }} className="p-1 text-gray-600 hover:text-red-400"><Trash2 size={13} /></button>
          {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{item.content}</p>
          <CopyButton text={item.content} />
        </div>
      )}
    </div>
  );
}

export default function Scripts() {
  const [scripts, setScripts] = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [addCategory, setAddCategory] = useState(null);

  function load() {
    apiFetch('/api/scripts').then(r => r?.json()).then(d => d && setScripts(Array.isArray(d) ? d : []));
  }
  useEffect(() => { load(); }, []);

  const byCategory = cat => scripts.filter(s => s.category === cat).sort((a, b) => a.sort_order - b.sort_order);

  async function saveEdit(form) {
    await apiFetch(`/api/scripts/${editItem.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setEditItem(null); load();
  }

  async function saveAdd(form) {
    await apiFetch('/api/scripts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, category: addCategory }) });
    setAddCategory(null); load();
  }

  async function del(id) {
    if (!confirm('¿Eliminar?')) return;
    await apiFetch(`/api/scripts/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="p-4 md:p-6 space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BookOpen size={22} className="text-green-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Scripts & Objection Handler</h1>
          <p className="text-xs text-gray-500">Approved word-for-word scripts · RinRan brand voice</p>
        </div>
      </div>

      {/* Scripts */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Scripts</h2>
          <button onClick={() => setAddCategory('script')} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300">
            <Plus size={13} /> Agregar
          </button>
        </div>
        {byCategory('script').map(s => <ScriptCard key={s.id} item={s} onEdit={setEditItem} onDelete={del} />)}
      </section>

      {/* Objection Handler */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Objection Handler</h2>
            <p className="text-xs text-gray-600 mt-0.5">Approved by Jarxiel</p>
          </div>
          <button onClick={() => setAddCategory('objection')} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300">
            <Plus size={13} /> Agregar
          </button>
        </div>
        {byCategory('objection').map(s => <ObjectionCard key={s.id} item={s} onEdit={setEditItem} onDelete={del} />)}
      </section>

      {/* HAZ / NO HAGAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wide">✓ HAZ</h2>
            <button onClick={() => setAddCategory('do')} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300">
              <Plus size={13} /> Agregar
            </button>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
            {byCategory('do').map((s, i) => (
              <div key={s.id} className="flex items-start gap-2 px-3 py-2.5 group">
                <span className="text-green-500 text-xs font-bold shrink-0 mt-0.5">{i + 1}.</span>
                <p className="flex-1 text-xs text-gray-300">{s.title}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => setEditItem(s)} className="p-0.5 text-gray-600 hover:text-yellow-400"><Edit2 size={11} /></button>
                  <button onClick={() => del(s.id)} className="p-0.5 text-gray-600 hover:text-red-400"><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wide">✗ NO HAGAS</h2>
            <button onClick={() => setAddCategory('dont')} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300">
              <Plus size={13} /> Agregar
            </button>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
            {byCategory('dont').map((s, i) => (
              <div key={s.id} className="flex items-start gap-2 px-3 py-2.5 group">
                <span className="text-red-500 text-xs font-bold shrink-0 mt-0.5">{i + 1}.</span>
                <p className="flex-1 text-xs text-gray-300">{s.title}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => setEditItem(s)} className="p-0.5 text-gray-600 hover:text-yellow-400"><Edit2 size={11} /></button>
                  <button onClick={() => del(s.id)} className="p-0.5 text-gray-600 hover:text-red-400"><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {editItem && <EditModal item={editItem} onSave={saveEdit} onClose={() => setEditItem(null)} />}
      {addCategory && <AddModal category={addCategory} onSave={saveAdd} onClose={() => setAddCategory(null)} />}
    </div>
  );
}
