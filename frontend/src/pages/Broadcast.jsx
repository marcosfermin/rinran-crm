import { useEffect, useState } from 'react';
import { Send, Users, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function Broadcast() {
  const [categories, setCategories] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [form, setForm] = useState({ name: '', message: '', category_id: '' });
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(setCategories);
    loadBroadcasts();
  }, []);

  function loadBroadcasts() {
    fetch('/api/messages/broadcasts').then(r => r.json()).then(setBroadcasts);
  }

  async function previewCount() {
    const params = new URLSearchParams({ limit: 999 });
    if (form.category_id) params.set('category_id', form.category_id);
    const d = await fetch(`/api/contacts?${params}`).then(r => r.json());
    setPreview(d.total);
  }

  useEffect(() => { previewCount(); }, [form.category_id]);

  async function send(e) {
    e.preventDefault();
    if (!form.message.trim()) return;
    if (!confirm(`¿Enviar a ${preview} contactos?`)) return;
    setSending(true);
    const res = await fetch('/api/messages/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name || 'Broadcast',
        message: form.message,
        category_id: form.category_id || null,
      }),
    }).then(r => r.json());
    setSuccess(`Broadcast iniciado (ID ${res.broadcast_id}) — ${res.total} destinatarios`);
    setForm({ name: '', message: '', category_id: '' });
    setSending(false);
    setTimeout(() => { setSuccess(null); loadBroadcasts(); }, 3000);
  }

  function statusIcon(s) {
    if (s === 'completed') return <CheckCircle size={14} className="text-green-400" />;
    if (s === 'sending') return <Clock size={14} className="text-yellow-400" />;
    return <Clock size={14} className="text-gray-400" />;
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
              <label className="text-xs text-gray-400 mb-1 block">Mensaje *</label>
              <textarea
                required
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={5}
                placeholder="Hola! Te escribimos desde Rinran para informarte..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 resize-none"
              />
              <p className="text-xs text-gray-600 mt-1">{form.message.length} caracteres</p>
            </div>

            {preview !== null && (
              <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-800/40 rounded-lg px-4 py-3">
                <Users size={15} className="text-blue-400" />
                <span className="text-sm text-blue-300">Se enviará a <strong>{preview}</strong> contactos</span>
              </div>
            )}

            <button
              type="submit"
              disabled={sending || !form.message.trim() || preview === 0}
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
                  <div className="flex items-center gap-1">{statusIcon(b.status)}<span className="text-xs text-gray-400">{b.status}</span></div>
                </div>
                <p className="text-xs text-gray-400 truncate mb-2">{b.message}</p>
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
