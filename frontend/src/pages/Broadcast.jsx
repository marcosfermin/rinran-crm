import { useEffect, useRef, useState } from 'react';
import { Send, Users, CheckCircle, Clock, Paperclip, X, File, Image, ChevronDown, BarChart2, Calendar } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';

function DeliveryBar({ total, sent, delivered, read }) {
  if (!total) return null;
  const sentPct = Math.round((sent / total) * 100);
  const deliveredPct = Math.round(((delivered || 0) / total) * 100);
  const readPct = Math.round(((read || 0) / total) * 100);
  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center gap-2 text-[10px] text-gray-500">
        <span className="flex-1">Entrega</span>
        <span className="text-green-400">{sentPct}% enviado</span>
        <span className="text-blue-400">{deliveredPct}% entregado</span>
        <span className="text-purple-400">{readPct}% leído</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden flex">
        <div className="h-full bg-purple-500" style={{ width: `${readPct}%` }} title={`Leído: ${read || 0}`} />
        <div className="h-full bg-blue-500" style={{ width: `${Math.max(0, deliveredPct - readPct)}%` }} title={`Entregado: ${delivered || 0}`} />
        <div className="h-full bg-green-500/60" style={{ width: `${Math.max(0, sentPct - deliveredPct)}%` }} title={`Enviado: ${sent}`} />
      </div>
    </div>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const STAGES = [
  { key: '', label: 'Todos los contactos activos' },
  { key: 'nuevo', label: 'Nuevo' }, { key: 'contactado', label: 'Contactado' },
  { key: 'en_progreso', label: 'En progreso' }, { key: 'propuesta', label: 'Propuesta' },
  { key: 'ganado', label: 'Ganado' }, { key: 'perdido', label: 'Perdido' },
];

export default function Broadcast() {
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [form, setForm] = useState({ name: '', message: '', category_id: '', pipeline_stage: '', tag_id: '', scheduled_at: '' });
  const [attachFile, setAttachFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(null);
  const [expandedBroadcast, setExpandedBroadcast] = useState(null);
  const [recipients, setRecipients] = useState({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reschedulingId, setReschedulingId] = useState(null);
  const [rescheduleAt, setRescheduleAt] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    apiFetch('/api/categories').then(r => r?.json()).then(d => d && setCategories(Array.isArray(d) ? d : []));
    apiFetch('/api/tags').then(r => r?.json()).then(d => d && setTags(Array.isArray(d) ? d : []));
    loadBroadcasts();
  }, []);

  function loadBroadcasts() {
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    apiFetch(`/api/messages/broadcasts?${params}`).then(r => r?.json()).then(d => d && setBroadcasts(Array.isArray(d) ? d : []));
  }

  useEffect(() => { loadBroadcasts(); }, [dateFrom, dateTo]);

  async function cancelBroadcast(id) {
    if (!confirm('¿Cancelar este broadcast programado?')) return;
    const r = await apiFetch(`/api/messages/broadcasts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (r?.ok) loadBroadcasts();
  }

  async function rescheduleBroadcast(id) {
    if (!rescheduleAt) return;
    const r = await apiFetch(`/api/messages/broadcasts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: rescheduleAt }),
    });
    if (r?.ok) { setReschedulingId(null); setRescheduleAt(''); loadBroadcasts(); }
  }

  async function previewCount() {
    const params = new URLSearchParams({ limit: 1 });
    if (form.category_id) params.set('category_id', form.category_id);
    if (form.pipeline_stage) params.set('pipeline_stage', form.pipeline_stage);
    const r = await apiFetch(`/api/contacts?${params}`);
    const d = await r?.json();
    if (d) setPreview(d.total ?? 0);
  }

  useEffect(() => { previewCount(); }, [form.category_id, form.pipeline_stage, form.tag_id]);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setAttachFile({ name: file.name, type: file.type, size: file.size, data: dataUrl.split(',')[1], preview: file.type.startsWith('image/') ? dataUrl : null });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function send(e) {
    e.preventDefault();
    if (!form.message.trim() && !attachFile) return;
    const isScheduled = !!form.scheduled_at;
    if (!isScheduled && !confirm(`¿Enviar ahora a ${preview} contactos?`)) return;
    setSending(true);

    const body = {
      name: form.name || 'Broadcast',
      message: form.message,
      category_id: form.category_id || null,
      pipeline_stage: form.pipeline_stage || null,
      tag_id: form.tag_id || null,
      scheduled_at: form.scheduled_at || null,
    };
    if (attachFile) {
      body.file = { data: attachFile.data, filename: attachFile.name, mimetype: attachFile.type, caption: form.message || undefined };
    }

    const r = await apiFetch('/api/messages/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const res = await r?.json();
    if (res) {
      setSuccess(isScheduled
        ? `Broadcast programado para ${new Date(form.scheduled_at).toLocaleString('es')} — ${res.total} destinatarios`
        : `Broadcast iniciado (ID ${res.broadcast_id}) — ${res.total} destinatarios`);
    }
    setForm({ name: '', message: '', category_id: '', pipeline_stage: '', tag_id: '', scheduled_at: '' });
    setAttachFile(null);
    setSending(false);
    setTimeout(() => { setSuccess(null); loadBroadcasts(); }, 4000);
  }

  async function loadRecipients(broadcastId) {
    if (recipients[broadcastId]) { setExpandedBroadcast(expandedBroadcast === broadcastId ? null : broadcastId); return; }
    const r = await apiFetch(`/api/messages/broadcasts/${broadcastId}/recipients`);
    const d = await r?.json();
    if (Array.isArray(d)) {
      setRecipients(prev => ({ ...prev, [broadcastId]: d }));
      setExpandedBroadcast(broadcastId);
    }
  }

  function statusIcon(s) {
    if (s === 'completed') return <CheckCircle size={14} className="text-green-400" />;
    if (s === 'scheduled') return <Calendar size={14} className="text-blue-400" />;
    return <Clock size={14} className={s === 'sending' ? 'text-yellow-400 animate-pulse' : 'text-gray-400'} />;
  }

  const recipientStatusColor = { sent: 'text-green-400', delivered: 'text-blue-400', read: 'text-purple-400', failed: 'text-red-400', pending: 'text-gray-500' };
  const recipientStatusLabel = { sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'Fallido', pending: 'Pendiente' };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <h1 className="text-xl font-bold text-white">Envío masivo</h1>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Compose */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Nuevo broadcast</h2>
          {success && (
            <div className="mb-4 px-4 py-3 bg-green-900/30 border border-green-800 rounded-lg text-green-400 text-sm">{success}</div>
          )}
          <form onSubmit={send} className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre del broadcast</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Promo Julio 2026"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Categoría</label>
                <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
                  <option value="">Todas las categorías</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Pipeline</label>
                <select value={form.pipeline_stage} onChange={e => setForm(f => ({ ...f, pipeline_stage: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
                  {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>
            {tags.length > 0 && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Tag</label>
                <select value={form.tag_id} onChange={e => setForm(f => ({ ...f, tag_id: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
                  <option value="">Todos los tags</option>
                  {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Mensaje {attachFile ? '(descripción)' : '*'}</label>
              <textarea required={!attachFile} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={4}
                placeholder="Hola, te escribimos para informarte..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 resize-none" />
              <p className="text-xs text-gray-600 mt-1">{form.message.length} caracteres</p>
            </div>

            {/* File */}
            <div>
              {attachFile ? (
                <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2.5">
                  {attachFile.preview
                    ? <img src={attachFile.preview} className="w-10 h-10 rounded object-cover shrink-0" />
                    : <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center shrink-0"><File size={18} className="text-gray-400" /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{attachFile.name}</p>
                    <p className="text-xs text-gray-500">{formatSize(attachFile.size)}</p>
                  </div>
                  <button type="button" onClick={() => setAttachFile(null)} className="p-1 text-gray-500 hover:text-white"><X size={15} /></button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-dashed border-gray-700 hover:border-gray-500 rounded-lg px-4 py-2.5 w-full transition-colors">
                  <Paperclip size={15} /> Adjuntar archivo
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="*/*" className="hidden" onChange={handleFileSelect} />
            </div>

            {/* Schedule */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1.5"><Calendar size={11} /> Programar envío (dejar vacío = enviar ahora)</label>
              <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>

            {preview !== null && (
              <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-800/40 rounded-lg px-4 py-3">
                <Users size={15} className="text-blue-400" />
                <span className="text-sm text-blue-300">Se enviará a <strong>{preview}</strong> contactos</span>
              </div>
            )}

            <button type="submit" disabled={sending || (!form.message.trim() && !attachFile) || preview === 0}
              className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
              {form.scheduled_at ? <Calendar size={15} /> : <Send size={15} />}
              {sending ? 'Procesando...' : form.scheduled_at ? 'Programar' : `Enviar a ${preview ?? '...'} contactos`}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-gray-300">Historial</h2>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-green-500" />
              <span className="text-gray-600 text-xs">—</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-green-500" />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-gray-500 hover:text-white">✕</button>
              )}
            </div>
          </div>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {broadcasts.map(b => (
              <div key={b.id} className="bg-gray-800 rounded-lg overflow-hidden">
                <button className="w-full text-left p-4 hover:bg-gray-750 transition-colors"
                  onClick={() => loadRecipients(b.id)}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-white">{b.name}</p>
                      <p className="text-xs text-gray-500">
                        {b.scheduled_at && b.status === 'scheduled'
                          ? `Programado: ${new Date(b.scheduled_at.replace(' ', 'T') + 'Z').toLocaleString('es')}`
                          : new Date(b.created_at).toLocaleString('es')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {statusIcon(b.status)}
                      <span className="text-xs text-gray-400 ml-1">{b.status}</span>
                      <ChevronDown size={12} className={`ml-1 text-gray-600 transition-transform ${expandedBroadcast === b.id ? 'rotate-180' : ''}`} />
                    </div>
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
                    <span className="text-green-400">✓ {b.sent_count}</span>
                    {b.delivered_count > 0 && <span className="text-blue-400">● {b.delivered_count}</span>}
                    {b.read_count > 0 && <span className="text-purple-400">👁 {b.read_count}</span>}
                    {b.failed_count > 0 && <span className="text-red-400">✗ {b.failed_count}</span>}
                  </div>
                  <DeliveryBar total={b.total_recipients} sent={b.sent_count} delivered={b.delivered_count} read={b.read_count} />
                </button>

                {b.status === 'scheduled' && (
                  <div className="border-t border-gray-700 px-4 py-3 flex items-center gap-2 bg-yellow-950/20">
                    {reschedulingId === b.id ? (
                      <>
                        <input type="datetime-local" value={rescheduleAt} onChange={e => setRescheduleAt(e.target.value)}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500" />
                        <button onClick={() => rescheduleBroadcast(b.id)} disabled={!rescheduleAt}
                          className="text-xs px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-black font-medium">Guardar</button>
                        <button onClick={() => setReschedulingId(null)} className="text-xs text-gray-500 hover:text-white">✕</button>
                      </>
                    ) : (
                      <>
                        <button onClick={e => { e.stopPropagation(); setReschedulingId(b.id); setRescheduleAt(b.scheduled_at?.slice(0,16) || ''); }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-yellow-700 text-yellow-400 hover:bg-yellow-500/10">
                          Reprogramar
                        </button>
                        <button onClick={e => { e.stopPropagation(); cancelBroadcast(b.id); }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-800 text-red-400 hover:bg-red-500/10">
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                )}
                {expandedBroadcast === b.id && recipients[b.id] && (
                  <div className="border-t border-gray-700 max-h-48 overflow-y-auto">
                    <div className="p-2 flex items-center gap-1 text-xs text-gray-500 border-b border-gray-700">
                      <BarChart2 size={11} /> {recipients[b.id].length} destinatarios
                    </div>
                    {recipients[b.id].map(r => (
                      <div key={r.id} className="flex items-center justify-between px-4 py-2 border-b border-gray-700/50 last:border-0">
                        <div>
                          <p className="text-xs text-white">{r.name}</p>
                          <p className="text-[10px] text-gray-500">{r.phone}</p>
                        </div>
                        <span className={`text-[10px] font-medium ${recipientStatusColor[r.status] || 'text-gray-500'}`}>
                          {recipientStatusLabel[r.status] || r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!broadcasts.length && <p className="text-gray-600 text-sm">Sin broadcasts aún</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
