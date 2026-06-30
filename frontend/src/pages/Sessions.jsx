import { useEffect, useState, useRef } from 'react';
import { Plus, RefreshCw, Trash2, QrCode, Wifi, WifiOff, Webhook, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Loader, Phone, Zap } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';
import QRCode from 'qrcode';

// Direct WAHA calls — nginx injects X-Api-Key, no backend involved
async function wahaFetch(path, options = {}) {
  try {
    const res = await fetch(`/waha${path}`, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      ...options,
    });
    return res;
  } catch (e) {
    console.error('[waha]', path, e.message);
    return null;
  }
}
async function wahaGet(path) {
  const r = await wahaFetch(path);
  return r?.ok ? r.json() : null;
}
async function wahaPost(path, body) {
  return wahaFetch(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}
async function wahaPut(path, body) {
  return wahaFetch(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
}
async function wahaDelete(path) {
  return wahaFetch(path, { method: 'DELETE' });
}

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
  const [qrImage, setQrImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  async function fetchQr() {
    const d = await wahaGet(`/api/${session}/auth/qr`);
    if (d?.value) {
      try {
        const img = await QRCode.toDataURL(d.value, { margin: 2, width: 300 });
        setQrImage(img); setLoading(false);
      } catch {}
    } else if (d?.image) {
      setQrImage(d.image); setLoading(false);
    }
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
        ) : qrImage ? (
          <img src={qrImage} alt="QR Code" className="w-full rounded-lg bg-white p-2" />
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
    // Backend used here only to resolve the correct internal webhook URL
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
            placeholder="http://backend:4000/webhook"
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
  const [wahaOnline, setWahaOnline] = useState(null);
  const [wahaVersion, setWahaVersion] = useState(null);
  const [selfWebhook, setSelfWebhook] = useState('http://backend:4000/webhook');
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

  async function loadVersion() {
    const d = await wahaGet('/api/version');
    if (d) { setWahaOnline(true); setWahaVersion(d); }
    else setWahaOnline(false);
  }

  async function load() {
    const d = await wahaGet('/api/sessions');
    if (Array.isArray(d)) setSessions(d);
  }

  async function loadDetails(name) {
    const d = await wahaGet(`/api/sessions/${name}`);
    if (d) setSessionDetails(prev => ({ ...prev, [name]: d }));
  }

  async function loadWebhookUrl() {
    const r = await apiFetch('/api/wa/info').catch(() => null);
    const d = await r?.json().catch(() => null);
    if (d?.webhook_url) setSelfWebhook(d.webhook_url);
  }

  useEffect(() => {
    loadVersion();
    load();
    loadWebhookUrl();
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
    const config = {
      noweb: { store: { enabled: true, fullSync: true } },
      ...(autoWebhook ? {
        webhooks: [{ url: selfWebhook, events: ['message', 'message.ack', 'session.status'], enabled: true }]
      } : {}),
    };
    let r = await wahaPost('/api/sessions', { name: newName.trim(), config });
    // WAHA returns 422 when session already exists — update config via PUT
    if (r?.status === 422) {
      const body = await r.text().catch(() => '');
      if (body.includes('already exists')) {
        r = await wahaPut(`/api/sessions/${newName.trim()}`, { config });
      }
    }
    setCreating(false);
    if (r?.ok || r?.status === 201) {
      setShowAdd(false); setNewName('default'); load();
    } else {
      const d = await r?.json().catch(() => ({}));
      setCreateError(d?.message || d?.error || `Error ${r?.status || ''}`);
    }
  }

  async function sessionAction(name, act) {
    await wahaPost(`/api/sessions/${name}/${act}`);
    load();
    if (expanded === name) setTimeout(() => loadDetails(name), 1500);
  }

  async function remove(name) {
    if (!confirm(`¿Eliminar sesión "${name}"? Se perderá la conexión con ese número.`)) return;
    await wahaDelete(`/api/sessions/${name}`);
    setExpanded(null); load();
  }

  async function applyWebhook(name) {
    await apiFetch(`/api/wa/sessions/${name}/webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    await loadDetails(name);
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
          <button onClick={() => { loadVersion(); load(); }} className="p-2 text-gray-500 hover:text-white border border-gray-700 rounded-lg">
            <RefreshCw size={15} />
          </button>
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-white px-3 py-2 rounded-xl text-sm font-medium">
            <Plus size={16} /> Nueva sesión
          </button>
        </div>
      </div>

      {/* WAHA server status */}
      <div className={`rounded-xl border p-4 ${wahaOnline === null ? 'border-gray-800 bg-gray-900' : wahaOnline ? 'border-green-800 bg-green-950/20' : 'border-red-800 bg-red-950/20'}`}>
        {wahaOnline === null ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader size={14} className="animate-spin" /> Conectando con WAHA…</div>
        ) : wahaOnline ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <CheckCircle size={14} className="text-green-400" />
                <span className="text-sm font-medium text-white">WAHA en línea</span>
                {wahaVersion?.version && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">v{wahaVersion.version}</span>}
                {wahaVersion?.engine && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{wahaVersion.engine}</span>}
                {wahaVersion?.tier && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{wahaVersion.tier}</span>}
              </div>
              <p className="text-[10px] text-gray-500">Conexión directa vía nginx · sin backend</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">{workingCount}/{sessions.length} sesión{sessions.length !== 1 ? 'es' : ''} activa{workingCount !== 1 ? 's' : ''}</p>
              <p className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[200px]">Webhook: <span className="text-gray-500">{selfWebhook}</span></p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle size={14} />
            <span>WAHA no disponible — verifica que el servicio esté corriendo</span>
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
              <input type="checkbox" checked={autoWebhook} onChange={e => setAutoWebhook(e.target.checked)} className="w-4 h-4 accent-green-500" />
              <span className="text-sm text-gray-300">Configurar webhook automáticamente</span>
            </label>
            {autoWebhook && (
              <p className="text-xs text-gray-500 bg-gray-800 rounded-lg px-3 py-2">
                WAHA enviará mensajes a: <code className="text-green-400">{selfWebhook}</code>
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

                <div className="flex items-center gap-1 shrink-0">
                  {s.status === 'SCAN_QR_CODE' && (
                    <button onClick={() => setQrSession(s.name)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-400 border border-blue-800 hover:bg-blue-900/20 rounded-lg">
                      <QrCode size={13} /> Escanear QR
                    </button>
                  )}
                  {(s.status === 'FAILED' || s.status === 'STOPPED') && (
                    <button onClick={() => sessionAction(s.name, 'start')}
                      className="px-2.5 py-1.5 text-xs text-green-400 border border-green-800 hover:bg-green-900/20 rounded-lg">Iniciar</button>
                  )}
                  {s.status === 'WORKING' && (
                    <button onClick={() => sessionAction(s.name, 'stop')}
                      className="px-2.5 py-1.5 text-xs text-yellow-400 border border-yellow-800 hover:bg-yellow-900/20 rounded-lg">Pausar</button>
                  )}
                  <button onClick={() => sessionAction(s.name, 'restart')} title="Reiniciar"
                    className="p-1.5 text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg">
                    <RefreshCw size={13} />
                  </button>
                  <button onClick={() => remove(s.name)} title="Eliminar"
                    className="p-1.5 text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-800 rounded-lg">
                    <Trash2 size={13} />
                  </button>
                  <button onClick={() => toggleExpand(s.name)}
                    className="p-1.5 text-gray-500 hover:text-white border border-gray-700 rounded-lg">
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-800 px-4 py-4 space-y-4 bg-gray-950/40">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5"><Webhook size={11} /> Webhook</p>
                    {firstWebhook ? (
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs text-green-400 bg-gray-800 px-3 py-1.5 rounded-lg truncate">{firstWebhook}</code>
                        <button onClick={() => setWebhookSession(s.name)}
                          className="text-xs px-2.5 py-1.5 border border-gray-700 text-gray-400 hover:text-white rounded-lg shrink-0">Cambiar</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-yellow-400 flex-1">Sin webhook configurado</p>
                        <button onClick={() => setWebhookSession(s.name)}
                          className="text-xs px-2.5 py-1.5 bg-yellow-500/10 border border-yellow-700 text-yellow-400 rounded-lg">Configurar</button>
                      </div>
                    )}
                  </div>

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

                  {s.me && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5"><Phone size={11} /> Número vinculado</p>
                      <div className="bg-gray-800 rounded-lg px-3 py-2.5">
                        <p className="text-sm text-white font-medium">{s.me.pushName}</p>
                        <p className="text-xs text-gray-500">+{s.me.id?.replace('@c.us', '')}</p>
                      </div>
                    </div>
                  )}

                  {details?.config?.noweb && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-1.5">NOWEB store</p>
                      <p className="text-xs text-gray-500">
                        Enabled: <span className={details.config.noweb.store?.enabled ? 'text-green-400' : 'text-red-400'}>{String(!!details.config.noweb.store?.enabled)}</span>
                        {' · '}fullSync: <span className={details.config.noweb.store?.fullSync ? 'text-green-400' : 'text-gray-500'}>{String(!!details.config.noweb.store?.fullSync)}</span>
                      </p>
                    </div>
                  )}

                  {!firstWebhook && (
                    <button onClick={() => applyWebhook(s.name)}
                      className="w-full flex items-center justify-center gap-2 py-2 text-xs border border-green-800 text-green-400 hover:bg-green-500/10 rounded-lg">
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
        <WebhookModal session={webhookSession} defaultUrl={selfWebhook}
          onClose={() => setWebhookSession(null)}
          onSaved={() => { setWebhookSession(null); loadDetails(webhookSession); }} />
      )}
    </div>
  );
}
