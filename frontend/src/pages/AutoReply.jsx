import { useEffect, useRef, useState } from 'react';
import { Bot, Plus, Trash2, ToggleLeft, ToggleRight, Edit2, Paperclip, X, File, Image } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';

const TRIGGER_TYPES = [
  { value: 'first_contact', label: 'Primer mensaje', hint: 'Se activa la primera vez que un contacto escribe' },
  { value: 'keyword',       label: 'Palabra clave',  hint: 'Se activa cuando el mensaje contiene el texto indicado' },
  { value: 'after_hours',   label: 'Fuera de horario', hint: 'Se activa cuando el mensaje llega fuera del horario (ej: 09:00-18:00)' },
  { value: 'always',        label: 'Siempre',         hint: 'Responde a todos los mensajes entrantes (úsalo con cuidado)' },
];

const EMPTY = { name: '', trigger_type: 'first_contact', trigger_value: '', response: '' };

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AutoReply() {
  const [rules, setRules] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [attachFile, setAttachFile] = useState(null);
  const [existingAttachment, setExistingAttachment] = useState(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const fileInputRef = useRef(null);

  function load() {
    apiFetch('/api/auto-reply').then(r => r?.json()).then(d => d && setRules(Array.isArray(d) ? d : []));
  }
  useEffect(() => { load(); }, []);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setAttachFile({ name: file.name, type: file.type, size: file.size, data: dataUrl.split(',')[1], preview: file.type.startsWith('image/') ? dataUrl : null });
      setRemoveAttachment(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function startEdit(rule) {
    setEditId(rule.id);
    setForm({ name: rule.name, trigger_type: rule.trigger_type, trigger_value: rule.trigger_value || '', response: rule.response || '' });
    setAttachFile(null);
    setRemoveAttachment(false);
    setExistingAttachment(rule.attachment_url ? { url: rule.attachment_url, filename: rule.attachment_filename, mimetype: rule.attachment_mimetype } : null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false); setEditId(null); setForm(EMPTY);
    setAttachFile(null); setExistingAttachment(null); setRemoveAttachment(false);
  }

  async function save(e) {
    e.preventDefault();
    if (!form.response.trim() && !attachFile && !(existingAttachment && !removeAttachment)) {
      alert('Agrega un mensaje de respuesta o un adjunto');
      return;
    }
    const body = { ...form };
    if (attachFile) {
      body.file = { data: attachFile.data, filename: attachFile.name, mimetype: attachFile.type };
    } else if (removeAttachment) {
      body.remove_attachment = true;
    }
    if (editId) {
      await apiFetch(`/api/auto-reply/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      await apiFetch('/api/auto-reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    cancelForm();
    load();
  }

  async function toggle(rule) {
    await apiFetch(`/api/auto-reply/${rule.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !rule.is_active }) });
    load();
  }

  async function del(id) {
    if (!confirm('¿Eliminar regla?')) return;
    await apiFetch(`/api/auto-reply/${id}`, { method: 'DELETE' });
    load();
  }

  const triggerHint = TRIGGER_TYPES.find(t => t.value === form.trigger_type)?.hint;
  const activeAttach = attachFile || (existingAttachment && !removeAttachment ? existingAttachment : null);
  const activePreview = attachFile?.preview || (existingAttachment && !removeAttachment && existingAttachment?.mimetype?.startsWith('image/') ? existingAttachment.url : null);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-purple-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Auto-respuesta</h1>
            <p className="text-xs text-gray-500">Reglas automáticas para mensajes entrantes</p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY); setAttachFile(null); setExistingAttachment(null); setRemoveAttachment(false); }}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <Plus size={16} /> Nueva regla
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">{editId ? 'Editar regla' : 'Nueva regla'}</h2>
          <form onSubmit={save} className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre de la regla *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Bienvenida nuevos contactos"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Disparador *</label>
                <select value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value, trigger_value: '' }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
                  {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {(form.trigger_type === 'keyword' || form.trigger_type === 'after_hours') && (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    {form.trigger_type === 'keyword' ? 'Palabra clave' : 'Horario (HH:MM-HH:MM)'}
                  </label>
                  <input value={form.trigger_value}
                    onChange={e => setForm(f => ({ ...f, trigger_value: e.target.value }))}
                    placeholder={form.trigger_type === 'keyword' ? 'precio' : '09:00-18:00'}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
                </div>
              )}
            </div>
            {triggerHint && <p className="text-xs text-gray-600 -mt-1">{triggerHint}</p>}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Mensaje de respuesta</label>
              <textarea value={form.response} onChange={e => setForm(f => ({ ...f, response: e.target.value }))} rows={3}
                placeholder="Hola {{nombre}}, gracias por escribirnos. Te responderemos pronto."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 resize-none" />
              <p className="text-xs text-gray-600 mt-1">Variables: {'{{nombre}}'}, {'{{telefono}}'}. Puede ser solo texto, solo adjunto, o ambos.</p>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Adjunto (opcional)</label>
              <input ref={fileInputRef} type="file" accept="*/*" className="hidden" onChange={handleFileSelect} />
              {activeAttach ? (
                <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                  {activePreview
                    ? <img src={activePreview} className="w-12 h-12 rounded object-cover shrink-0" alt="" />
                    : <div className="w-12 h-12 rounded bg-gray-700 flex items-center justify-center shrink-0">
                        {(attachFile?.type || existingAttachment?.mimetype || '').startsWith('image/')
                          ? <Image size={16} className="text-gray-400" />
                          : <File size={16} className="text-gray-400" />}
                      </div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{attachFile?.name || existingAttachment?.filename}</p>
                    {attachFile && <p className="text-xs text-gray-500">{formatSize(attachFile.size)}</p>}
                  </div>
                  <button type="button" onClick={() => fileInputRef.current.click()} className="text-xs text-blue-400 hover:text-blue-300 shrink-0">Cambiar</button>
                  <button type="button" onClick={() => { setAttachFile(null); setRemoveAttachment(true); }} className="p-1 text-gray-500 hover:text-red-400"><X size={14} /></button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current.click()}
                  className="flex items-center gap-2 bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                  <Paperclip size={14} /> Adjuntar imagen o archivo
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={cancelForm}
                className="flex-1 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800">Cancelar</button>
              <button type="submit"
                className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-white text-sm font-medium">
                {editId ? 'Guardar cambios' : 'Crear regla'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {rules.map(rule => {
          const tt = TRIGGER_TYPES.find(t => t.value === rule.trigger_type);
          const isImage = rule.attachment_mimetype?.startsWith('image/');
          return (
            <div key={rule.id} className={`bg-gray-900 border rounded-xl p-4 transition-colors ${rule.is_active ? 'border-gray-800' : 'border-gray-800 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white">{rule.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${rule.is_active ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                      {rule.is_active ? 'activa' : 'pausada'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <span className="bg-gray-800 px-2 py-0.5 rounded">{tt?.label}</span>
                    {rule.trigger_value && <span className="text-gray-400">"{rule.trigger_value}"</span>}
                  </div>
                  {rule.response ? <p className="text-xs text-gray-400 truncate">{rule.response}</p> : null}
                  {rule.attachment_url && (
                    <div className="mt-1.5">
                      {isImage
                        ? <img src={rule.attachment_url} alt={rule.attachment_filename} className="rounded-lg max-h-24 max-w-xs object-cover" />
                        : <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Paperclip size={12} /><span className="truncate">{rule.attachment_filename}</span>
                          </div>}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => toggle(rule)} className="p-1.5 text-gray-500 hover:text-white rounded-lg" title={rule.is_active ? 'Pausar' : 'Activar'}>
                    {rule.is_active ? <ToggleRight size={16} className="text-green-400" /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => startEdit(rule)} className="p-1.5 text-gray-500 hover:text-white rounded-lg"><Edit2 size={14} /></button>
                  <button onClick={() => del(rule.id)} className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          );
        })}
        {!rules.length && (
          <div className="text-center py-12 text-gray-600">
            <Bot size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin reglas de auto-respuesta</p>
            <p className="text-xs mt-1">Crea una regla para responder automáticamente a mensajes entrantes</p>
          </div>
        )}
      </div>
    </div>
  );
}
