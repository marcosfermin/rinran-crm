import { useEffect, useState, useRef } from 'react';
import { Plus, RefreshCw, Trash2, QrCode, Wifi, WifiOff, Webhook, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Loader, Phone, Zap } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';

const STATUS_COLOR = {
  WORKING:       'text-green-400 bg-green-500/10 border-green-800',
  STARTING:      'text-yellow-400 bg-yellow-500/10 border-yellow-800',
  SCAN_QR_CODE:  'text-blue-400 bg-blue-500/10 border-blue-800',
  FAILED:        'text-red-400 bg-red-500/10 border-red-800',
  STOPPED:       'text-gray-500 bg-gray-800 border-gray-700',
};
const STATUS_LABEL = {
  WORKING: 'Conectado', STARTING: 'Iniciando…', SCAN_QR_CODE: 'Esperando QR',
  FAILED: 'Error', STOPPED: 'Detenido',
};

function QrModal({ session, onClose }) {
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  async function fetchQr() {
    const r = await apiFetch(`/api/wa/sessions/${session}/qr`);
    const d = await r?.json();
    if (d?.image || d?.value) { setQr(d); setLoading(false); }
  }

  useEffect(() => {
    fetchQr();
    intervalRef.current = setInterval(fetchQr, 5000);
    return () => clearInterval(intervalRef.current);
  }, [session]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-white mb-1">Escanear QR — {session}</h3>
        <p className="text-xs text-gray-500 mb-4">
          Abre <strong className="text-white">WhatsApp</strong> → ··· → <strong className="text-white">Dispositivos vinculados</strong> → Vincular dispositivo
        </p>
        {loading ? (
          <div className="flex items-center justify-center h-52">
            <Loader size={28} className="animate-spin text-gray-500" />
          </div>
        ) : qr?.image ? (
          <img src={qr.image} alt="QR Code" className="w-full rounded-lg bg-white p-2" />
        ) : (
          <p className="text-center text-xs text-gray-500 py-8">QR no disponible aún — reintentando…</p>
        )}
        <p className="text-[10px] text-gray-600 text-center mt-3">Se actualiza automáticamente cada 5s</p>
        <button onClick={onClose} className="w-full mt-3 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800">
          Cerrar
        </button>
      </div>
    </div>
  );
}

function WebhookModal({ session, defaultUrl, onClose, onSaved }) {
  const [url, setUrl] = useState(defaultUrl || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function save(e) {
    e.preventDefault();
    setSaving(true); setMsg('');
    const r = await apiFetch(`/api/wa/sessions/${session}/webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhook_url: url }),
    });
    const d = await r?.json();
    setSaving(false);
    if (r?.ok) { setMsg('Webhook configurado ✓'); onSaved(url); setTimeout(onClose, 1500); }
    else setMsg(d?.error || 'Error al configurar');
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2"><Webhook size={14} /> Configurar Webhook — {session}</h3>
        <p className="text-xs text-gray-500 mb-4">WAHA enviará todos los eventos de mensajes a esta URL.</p>
        <form onSubmit={save} className="space-y-3">
          <input required value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://tu-servidor.com/webhook"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
          {msg && <p className={`text-xs ${msg.includes('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800">Cancelar</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white text-sm font-medium">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [wahaInfo, setWahaInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [qrSession, setQrSession] = useState(null);
  const [webhookSession, setWebhookSession] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [sessionDetails, setSessionDetails] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('default');
  const [autoWebhook, setAutoWebhook] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const polling = useRef(null);

  function loadInfo() {
    apiFetch('/api/wa/info').then(r => r?.json()).then(d => { d && setWahaInfo(d); setInfoLoading(false); });
  }

  function load() {
    apiFetch('/api/wa/sessions').then(r => r?.json()).then(d => d && setSessions(Array.isArray(d) ? d : []));
  }

  async function loadDetails(name) {
    const r = await apiFetch(`/api/wa/sessions/${name}`);
    const d = await r?.json();
    if (d) setSessionDetails(prev => ({ ...prev, [name]: d }));
  }

  useEffect(() => {
    loadInfo();
    load();
    polling.current = setInterval(load, 5000);
    return () => clearInterval(polling.current);
  }, []);

  async function toggleExpand(name) {
    if (expanded === name) { setExpanded(null); return; }
    setExpanded(name);
    if (!sessionDetails[name]) await loadDetails(name);
  }

  async function create(e) {
    e.preventDefault();
    setCreating(true); setCreateError('');
    const r = await apiFetch('/api/wa/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), auto_webhook: autoWebhook }),
    });
    const d = await r?.json();
    setCreating(false);
    if (r?.ok || r?.status === 201) {
      setShowAdd(false); setNewName('default'); load();
    } else {
      setCreateError(d?.message || d?.error || 'Error al crear sesión');
    }
  }

  async function action(name, act) {
    await apiFetch(`/api/wa/sessions/${name}/${act}`, { method: 'POST' });
    load();
    if (expanded === name) setTimeout(() => loadDetails(name), 1500);
  }

  async function remove(name) {
    if (!confirm(`¿Eliminar sesión "${name}"? Se perderá la conexión con ese número.`)) return;
    await apiFetch(`/api/wa/sessions/${name}`, { method: 'DELETE' });
    setExpanded(null);
    load();
  }

  const workingCount = sessions.filter(s => s.status === 'WORKING').length;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi size={20} className="text-green-400" />
          <h1 className="text-xl font-bold text-white">WhatsApp / WAHA</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { loadInfo(); load(); }} className="p-2 text-gray-500 hover:text-white border border-gray-700 rounded-lg">
            <RefreshCw size={15} />
          </button>
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-white px-3 py-2 rounded-xl text-sm font-medium">
            <Plus size={16} /> Nueva sesión
          </button>
        </div>
      </div>

      {/* WAHA server info */}
      <div className={`rounded-xl border p-4 ${infoLoading ? 'border-gray-800 bg-gray-900' : wahaInfo?.health ? 'border-green-800 bg-green-950/20' : 'border-red-800 bg-red-950/20'}`}>
        {infoLoading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader size={14} className="animate-spin" /> Conectando con WAHA…</div>
        ) : wahaInfo?.health ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={14} className="text-green-400" />
                <span className="text-sm font-medium text-white">WAHA en línea</span>
                {wahaInfo.version?.version && (
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">v{wahaInfo.version.version}</span>
                )}
                {wahaInfo.version?.engine && (
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{wahaInfo.version.engine}</span>
                )}
              </div>
              <p className="text-xs text-gray-500">{wahaInfo.url}</p>
              {wahaInfo.version?.tier && (
                <p className="text-xs text-gray-600 mt-0.5">Tier: {wahaInfo.version.tier}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">{workingCount}/{sessions.length} sesión{sessions.length !== 1 ? 'es' : ''} activa{workingCount !== 1 ? 's' : ''}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">Webhook: <span className="text-gray-500">{wahaInfo.webhook_url}</span></p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle size={14} />
            <span>WAHA no disponible en <code className="text-xs">{wahaInfo?.url || 'http://waha:3000'}</code></span>
          </div>
        )}
      </div>

      {/* Create session form */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Nueva sesión WhatsApp</h2>
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre de la sesión</label>
              <input required value={newName} onChange={e => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                placeholder="default"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
              <p className="text-[11px] text-gray-600 mt-1">Solo letras minúsculas, números y guiones</p>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={autoWebhook} onChange={e => setAutoWebhook(e.target.checked)}
                className="w-4 h-4 accent-green-500" />
              <span className="text-sm text-gray-300">Configurar webhook automáticamente</span>
            </label>
            {autoWebhook && (
              <p className="text-xs text-gray-500 bg-gray-800 rounded-lg px-3 py-2">
                WAHA enviará mensajes a: <code className="text-green-400">{wahaInfo?.webhook_url || 'http://backend:4000/webhook'}</code>
              </p>
            )}
            {createError && <p className="text-xs text-red-400">{createError}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowAdd(false); setCreateError(''); }}
                className="flex-1 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800">Cancelar</button>
              <button type="submit" disabled={creating}
                className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white text-sm font-medium">
                {creating ? 'Creando…' : 'Crear sesión'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sessions list */}
      <div className="space-y-3">
        {sessions.map(s => {
          const details = sessionDetails[s.name];
          const webhooks = details?.config?.webhooks || [];
          const firstWebhook = webhooks[0]?.url || null;
          const isExpanded = expanded === s.name;

          return (
            <div key={s.name} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {/* Session header */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">{s.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[s.status] || 'text-gray-400 bg-gray-800 border-gray-700'}`}>
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                  </div>
                  {s.me?.pushName && (
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <Phone size={10} /> {s.me.pushName} · {s.me.id?.replace('@c.us', '')}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {s.status === 'SCAN_QR_CODE' && (
                    <button onClick={() => setQrSession(s.name)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-400 border border-blue-800 hover:bg-blue-900/20 rounded-lg transition-colors">
                      <QrCode size={13} /> Escanear QR
                    </button>
                  )}
                  {(s.status === 'FAILED' || s.status === 'STOPPED') && (
                    <button onClick={() => action(s.name, 'start')}
                      className="px-2.5 py-1.5 text-xs text-green-400 border border-green-800 hover:bg-green-900/20 rounded-lg transition-colors">
                      Iniciar
                    </button>
                  )}
                  {s.status === 'WORKING' && (
                    <button onClick={() => action(s.name, 'stop')}
                      className="px-2.5 py-1.5 text-xs text-yellow-400 border border-yellow-800 hover:bg-yellow-900/20 rounded-lg transition-colors">
                      Pausar
                    </button>
                  )}
                  <button onClick={() => action(s.name, 'restart')} title="Reiniciar"
                    className="p-1.5 text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors">
                    <RefreshCw size={13} />
                  </button>
                  <button onClick={() => remove(s.name)} title="Eliminar"
                    className="p-1.5 text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-800 rounded-lg transition-colors">
                    <Trash2 size={13} />
                  </button>
                  <button onClick={() => toggleExpand(s.name)}
                    className="p-1.5 text-gray-500 hover:text-white border border-gray-700 rounded-lg transition-colors">
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              </div>

              {/* Expanded config */}
              {isExpanded && (
                <div className="border-t border-gray-800 px-4 py-4 space-y-4 bg-gray-950/40">
                  {/* Webhook */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5"><Webhook size={11} /> Webhook</p>
                    {firstWebhook ? (
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs text-green-400 bg-gray-800 px-3 py-1.5 rounded-lg truncate">{firstWebhook}</code>
                        <button onClick={() => setWebhookSession(s.name)}
                          className="text-xs px-2.5 py-1.5 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-lg shrink-0">
                          Cambiar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-yellow-400 flex-1">Sin webhook configurado</p>
                        <button onClick={() => setWebhookSession(s.name)}
                          className="text-xs px-2.5 py-1.5 bg-yellow-500/10 border border-yellow-700 text-yellow-400 hover:bg-yellow-500/20 rounded-lg">
                          Configurar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Events subscribed */}
                  {webhooks[0]?.events?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5"><Zap size={11} /> Eventos suscritos</p>
                      <div className="flex flex-wrap gap-1.5">
                        {webhooks[0].events.map(ev => (
                          <span key={ev} className="text-[10px] bg-gray-800 border border-gray-700 text-gray-300 px-2 py-0.5 rounded-full font-mono">{ev}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Linked phone details */}
                  {s.me && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5"><Phone size={11} /> Número vinculado</p>
                      <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2.5">
                        <div>
                          <p className="text-sm text-white font-medium">{s.me.pushName}</p>
                          <p className="text-xs text-gray-500">+{s.me.id?.replace('@c.us', '')}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* NOWEB config */}
                  {details?.config?.noweb && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-1.5">NOWEB store</p>
                      <p className="text-xs text-gray-500">
                        Enabled: <span className={details.config.noweb.store?.enabled ? 'text-green-400' : 'text-red-400'}>{String(!!details.config.noweb.store?.enabled)}</span>
                        {' · '}fullSync: <span className={details.config.noweb.store?.fullSync ? 'text-green-400' : 'text-gray-500'}>{String(!!details.config.noweb.store?.fullSync)}</span>
                      </p>
                    </div>
                  )}

                  {/* Quick-configure CRM webhook button */}
                  {!firstWebhook?.includes(wahaInfo?.webhook_url?.split('/')[2] || 'backend') && (
                    <button onClick={async () => {
                      await apiFetch(`/api/wa/sessions/${s.name}/webhook`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({}),
                      });
                      await loadDetails(s.name);
                    }}
                      className="w-full flex items-center justify-center gap-2 py-2 text-xs border border-green-800 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors">
                      <Zap size={12} /> Aplicar webhook del CRM automáticamente
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!sessions.length && (
          <div className="text-center py-14 text-gray-600">
            <WifiOff size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin sesiones creadas</p>
            <p className="text-xs mt-1 text-gray-700">Crea una sesión para vincular un número de WhatsApp</p>
          </div>
        )}
      </div>

      {qrSession && <QrModal session={qrSession} onClose={() => setQrSession(null)} />}
      {webhookSession && (
        <WebhookModal
          session={webhookSession}
          defaultUrl={wahaInfo?.webhook_url || ''}
          onClose={() => setWebhookSession(null)}
          onSaved={() => { setWebhookSession(null); loadDetails(webhookSession); }}
        />
      )}
    </div>
  );
}
