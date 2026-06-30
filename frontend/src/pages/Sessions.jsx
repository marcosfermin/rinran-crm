import { useEffect, useState, useRef } from 'react';
import { Plus, RefreshCw, Trash2, Power, QrCode, Wifi, WifiOff } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';

const STATUS_COLOR = {
  WORKING: 'text-green-400',
  STARTING: 'text-yellow-400',
  SCAN_QR_CODE: 'text-blue-400',
  FAILED: 'text-red-400',
  STOPPED: 'text-gray-500',
};

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [qr, setQr] = useState(null); // { session, value }
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const polling = useRef(null);

  function load() {
    apiFetch('/api/wa/sessions').then(r => r?.json()).then(d => d && setSessions(Array.isArray(d) ? d : []));
  }

  useEffect(() => {
    load();
    polling.current = setInterval(load, 5000);
    return () => clearInterval(polling.current);
  }, []);

  async function create(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    await apiFetch('/api/wa/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), config: { noweb: { store: { enabled: true, fullSync: true } } } }),
    });
    setShowAdd(false); setNewName(''); load();
  }

  async function action(name, act) {
    await apiFetch(`/api/wa/sessions/${name}/${act}`, { method: 'POST' });
    load();
  }

  async function remove(name) {
    if (!confirm(`¿Eliminar sesión "${name}"?`)) return;
    await apiFetch(`/api/wa/sessions/${name}`, { method: 'DELETE' });
    load();
  }

  async function showQr(name) {
    const r = await apiFetch(`/api/wa/sessions/${name}/qr`);
    const d = await r?.json();
    if (d?.value) setQr({ session: name, value: d.value });
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi size={20} className="text-green-400" />
          <h1 className="text-xl font-bold text-white">Sesiones WhatsApp</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:text-white border border-gray-700 rounded-lg">
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-white px-3 py-2 rounded-xl text-sm font-medium"
          >
            <Plus size={16} /> Nueva sesión
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <form onSubmit={create} className="flex gap-2">
            <input
              required value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Nombre de la sesión (ej: ventas)"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
            />
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800">
              Cancelar
            </button>
            <button type="submit"
              className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-white text-sm font-medium">
              Crear
            </button>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {sessions.map(s => (
          <div key={s.name} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {s.status === 'WORKING'
                    ? <Wifi size={15} className="text-green-400 shrink-0" />
                    : <WifiOff size={15} className="text-gray-500 shrink-0" />}
                  <span className="font-semibold text-white text-sm">{s.name}</span>
                  <span className={`text-xs font-medium ${STATUS_COLOR[s.status] || 'text-gray-400'}`}>
                    {s.status}
                  </span>
                </div>
                {s.me?.pushName && (
                  <p className="text-xs text-gray-500 ml-5">{s.me.pushName} · {s.me.id?.replace('@c.us', '')}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                {s.status === 'SCAN_QR_CODE' && (
                  <button onClick={() => showQr(s.name)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-blue-400 border border-blue-800 hover:bg-blue-900/20 rounded-lg transition-colors">
                    <QrCode size={13} /> QR
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
                <button onClick={() => action(s.name, 'restart')}
                  className="p-1.5 text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors">
                  <RefreshCw size={13} />
                </button>
                <button onClick={() => remove(s.name)}
                  className="p-1.5 text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-800 rounded-lg transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {!sessions.length && (
          <div className="text-center py-12 text-gray-600">
            <Wifi size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin sesiones activas</p>
          </div>
        )}
      </div>

      {/* QR Modal */}
      {qr && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setQr(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-1">Escanear QR — {qr.session}</h3>
            <p className="text-xs text-gray-500 mb-4">Abre WhatsApp → ··· → Dispositivos vinculados → Vincular dispositivo</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr.value)}`}
              alt="QR Code"
              className="w-full rounded-lg"
            />
            <button onClick={() => setQr(null)}
              className="w-full mt-4 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
