import { useEffect, useRef, useState } from 'react';
import { Send, Users, CheckCircle, Clock, Paperclip, X, File, Image } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function Broadcast() {
  const [categories, setCategories] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [form, setForm] = useState({ name: '', message: '', category_id: '' });
  const [attachFile, setAttachFile] = useState(null); // { name, type, size, data, preview }
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    apiFetch('/api/categories').then(r => r?.json()).then(d => d && setCategories(Array.isArray(d) ? d : []));
    loadBroadcasts();
  }, []);

  function loadBroadcasts() {
    apiFetch('/api/messages/broadcasts').then(r => r?.json()).then(d => d && setBroadcasts(Array.isArray(d) ? d : []));
  }

  async function previewCount() {
    const params = new URLSearchParams({ limit: 999 });
    if (form.category_id) params.set('category_id', form.category_id);
    const r = await apiFetch(`/api/contacts?${params}`);
    const d = await r?.json();
    if (d) setPreview(d.total ?? 0);
  }

  useEffect(() => { previewCount(); }, [form.category_id]);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setAttachFile({
        name: file.name,
        type: file.type,
        size: file.size,
        data: dataUrl.split(',')[1],
        preview: file.type.startsWith('image/') ? dataUrl : null,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function send(e) {
    e.preventDefault();
    if (!form.message.trim() && !attachFile) return;
    if (!confirm(`¿Enviar a ${preview} contactos?`)) return;
    setSending(true);

    const body = {
      name: form.name || 'Broadcast',
      message: form.message,
      category_id: form.category_id || null,
    };
    if (attachFile) {
      body.file = {
        data: attachFile.data,
        filename: attachFile.name,
        mimetype: attachFile.type,
        caption: form.message || undefined,
      };
    }

    const r = await apiFetch('/api/messages/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await r?.json();
    if (res) setSuccess(`Broadcast iniciado (ID ${res.broadcast_id}) — ${res.total} destinatarios`);
    setForm({ name: '', message: '', category_id: '' });
    setAttachFile(null);
    setSending(false);
    setTimeout(() => { setSuccess(null); loadBroadcasts(); }, 3000);
  }

  function statusIcon(s) {
    if (s === 'completed') return <CheckCircle size={14} className="text-green-400" />;
    return <Clock size={14} className={s === 'sending' ? 'text-yellow-400' : 'text-gray-400'} />;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Envío masivo</h1>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Compose */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Nuevo broadcast</h2>
          {success && (
            <div className="mb-4 px-4 py-3 bg-green-900/30 border border-green-800 rounded-lg text-green-400 text-sm">
              {success}
            </div>
          )}
          <form onSubmit={send} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre del broadcast</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Promo Julio 2026"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Categoría (vacío = todos)</label>
              <select
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
              >
                <option value="">Todos los contactos activos</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Mensaje {attachFile ? '(pie de foto / descripción)' : '*'}</label>
              <textarea
                required={!attachFile}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={4}
                placeholder={attachFile ? 'Descripción opcional del archivo...' : 'Hola! Te escribimos desde Rinran para informarte...'}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 resize-none"
              />
              <p className="text-xs text-gray-600 mt-1">{form.message.length} caracteres</p>
            </div>

            {/* File attachment */}
            <div>
              {attachFile ? (
                <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2.5">
                  {attachFile.preview
                    ? <img src={attachFile.preview} className="w-10 h-10 rounded object-cover shrink-0" />
                    : <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center shrink-0">
                        <File size={18} className="text-gray-400" />
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{attachFile.name}</p>
                    <p className="text-xs text-gray-500">{formatSize(attachFile.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachFile(null)}
                    className="p-1 text-gray-500 hover:text-white"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-dashed border-gray-700 hover:border-gray-500 rounded-lg px-4 py-2.5 w-full transition-colors"
                >
                  <Paperclip size={15} />
                  Adjuntar archivo (imagen, PDF, video, audio…)
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="*/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {preview !== null && (
              <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-800/40 rounded-lg px-4 py-3">
                <Users size={15} className="text-blue-400" />
                <span className="text-sm text-blue-300">Se enviará a <strong>{preview}</strong> contactos</span>
              </div>
            )}

            <button
              type="submit"
              disabled={sending || (!form.message.trim() && !attachFile) || preview === 0}
              className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Send size={15} />
              {sending ? 'Enviando...' : `Enviar a ${preview ?? '...'} contactos`}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Historial</h2>
          <div className="space-y-3">
            {broadcasts.map(b => (
              <div key={b.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-white">{b.name}</p>
                    <p className="text-xs text-gray-500">{new Date(b.created_at).toLocaleString('es')}</p>
                  </div>
                  <div className="flex items-center gap-1">{statusIcon(b.status)}<span className="text-xs text-gray-400 ml-1">{b.status}</span></div>
                </div>
                {b.media_filename && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
                    {b.media_type?.startsWith('image/') ? <Image size={12} /> : <File size={12} />}
                    <span className="truncate">{b.media_filename}</span>
                  </div>
                )}
                {b.message && <p className="text-xs text-gray-400 truncate mb-2">{b.message}</p>}
                <div className="flex gap-4 text-xs">
                  <span className="text-gray-500">Total: <span className="text-gray-300">{b.total_recipients}</span></span>
                  <span className="text-green-400">Enviados: {b.sent_count}</span>
                  {b.failed_count > 0 && <span className="text-red-400">Fallidos: {b.failed_count}</span>}
                </div>
              </div>
            ))}
            {!broadcasts.length && <p className="text-gray-600 text-sm">Sin broadcasts aún</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
