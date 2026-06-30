import { useEffect, useState } from 'react';
import { Activity, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';

function timeSince(ts) {
  const d = new Date(ts.replace(' ', 'T') + 'Z');
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return `${Math.round(diff)}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return d.toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const EVENT_COLORS = {
  'message': 'bg-blue-500/20 text-blue-300',
  'message.ack': 'bg-gray-700 text-gray-300',
  'session.status': 'bg-purple-500/20 text-purple-300',
  'unknown': 'bg-yellow-500/20 text-yellow-300',
};

export default function WebhookLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('');

  function load() {
    setLoading(true);
    apiFetch(`/api/webhook-log?limit=${limit}`).then(r => r?.json()).then(d => {
      d && setLogs(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, [limit]);

  async function clearLog() {
    if (!window.confirm('¿Limpiar todos los logs del webhook?')) return;
    await apiFetch('/api/webhook-log', { method: 'DELETE' });
    setLogs([]);
  }

  const filtered = filter ? logs.filter(l => l.event_type.includes(filter) || l.payload?.includes(filter)) : logs;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={20} className="text-purple-400" />
          <h1 className="text-xl font-bold text-white">Log de Webhooks</h1>
          <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full">{logs.length}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-gray-800">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={clearLog}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-800 text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 size={12} /> Limpiar
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filtrar por tipo o contenido..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-600" />
        <select value={limit} onChange={e => setLimit(Number(e.target.value))}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white">
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={500}>500</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-600">
          <Activity size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Sin eventos registrados</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(log => {
            const isOpen = expanded === log.id;
            const colorClass = EVENT_COLORS[log.event_type] || EVENT_COLORS['unknown'];
            let preview = '';
            try {
              const p = JSON.parse(log.payload);
              const d = p?.payload || p?.data || {};
              preview = d.body || d.content || d.text || d.from || '';
            } catch {}

            return (
              <div key={log.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : log.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/50 transition-colors">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded font-semibold shrink-0 ${colorClass}`}>
                    {log.event_type}
                  </span>
                  {log.session && <span className="text-xs text-gray-600 shrink-0">{log.session}</span>}
                  {preview && <span className="text-xs text-gray-500 truncate flex-1">{preview}</span>}
                  <span className="text-xs text-gray-600 shrink-0">{timeSince(log.received_at)}</span>
                  {isOpen ? <ChevronUp size={13} className="text-gray-600 shrink-0" /> : <ChevronDown size={13} className="text-gray-600 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-gray-800">
                    <pre className="mt-3 text-xs text-gray-300 bg-gray-950 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-80 overflow-y-auto">
                      {(() => { try { return JSON.stringify(JSON.parse(log.payload), null, 2); } catch { return log.payload; } })()}
                    </pre>
                    <p className="text-xs text-gray-600 mt-2">{new Date(log.received_at.replace(' ', 'T') + 'Z').toLocaleString()}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
