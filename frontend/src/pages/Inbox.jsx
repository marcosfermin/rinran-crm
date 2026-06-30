import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageSquare, RefreshCw, AlertTriangle, Filter, X } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';
import { Avatar, PhotoLightbox } from '../components/Avatar.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr.replace(' ', 'T') + 'Z');
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short' });
}

function useSyncStatus() {
  const [status, setStatus] = useState({ running: false, lastSync: null, imported: { contacts: 0, messages: 0 } });
  const polling = useRef(null);

  const check = useCallback(() => {
    apiFetch('/api/sync').then(r => r?.json()).then(d => d && setStatus(d)).catch(() => {});
  }, []);

  const startSync = useCallback(async () => {
    await apiFetch('/api/sync', { method: 'POST' });
    check();
    polling.current = setInterval(() => {
      apiFetch('/api/sync').then(r => r?.json()).then(d => {
        if (!d) return;
        setStatus(d);
        if (!d.running) clearInterval(polling.current);
      }).catch(() => {});
    }, 2000);
  }, [check]);

  useEffect(() => {
    check();
    return () => clearInterval(polling.current);
  }, [check]);

  return { status, startSync };
}

const CONV_STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'open', label: 'Abierto' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'closed', label: 'Cerrado' },
];

const CONV_STATUS_COLORS = {
  open: 'text-green-400',
  pending: 'text-yellow-400',
  closed: 'text-gray-500',
};

export default function InboxPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const [convStatusFilter, setConvStatusFilter] = useState('open');
  const [agentFilter, setAgentFilter] = useState('');
  const [team, setTeam] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const { status: syncStatus, startSync } = useSyncStatus();

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (convStatusFilter) params.set('conv_status', convStatusFilter);
    if (agentFilter) params.set('assigned_to', agentFilter);
    apiFetch(`/api/inbox?${params}`)
      .then(r => r?.json())
      .then(data => data && setConversations(data))
      .catch(() => {});
  }, [search, convStatusFilter, agentFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (user?.role === 'admin') {
      apiFetch('/api/team').then(r => r?.json()).then(d => d && setTeam(Array.isArray(d) ? d : []));
    }
  }, [user]);

  const wasSyncing = useRef(false);
  useEffect(() => {
    if (wasSyncing.current && !syncStatus.running) load();
    wasSyncing.current = syncStatus.running;
  }, [syncStatus.running]);

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);
  const slaBreaches = conversations.filter(c => c.sla_breach).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Bandeja</h1>
            {totalUnread > 0 && (
              <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
            {slaBreaches > 0 && (
              <span className="bg-red-500/20 text-red-400 border border-red-800 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={10} /> {slaBreaches} SLA
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 text-xs border px-3 py-1.5 rounded-lg transition-colors ${showFilters || convStatusFilter || agentFilter ? 'text-green-400 border-green-700 bg-green-500/10' : 'text-gray-400 border-gray-700 hover:text-white'}`}>
              <Filter size={13} />
              {(convStatusFilter || agentFilter) ? 'Filtros activos' : 'Filtrar'}
            </button>
            <button
              onClick={startSync}
              disabled={syncStatus.running}
              title="Sincronizar historial de WhatsApp"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncStatus.running ? 'animate-spin' : ''} />
              {syncStatus.running ? 'Sync...' : 'Sync'}
            </button>
          </div>
        </div>

        {/* Sync progress */}
        {syncStatus.running && (
          <div className="mb-2 text-xs text-gray-500 px-0.5">
            Importando... {syncStatus.imported.contacts} contactos · {syncStatus.imported.messages} mensajes
          </div>
        )}
        {syncStatus.lastSync && !syncStatus.running && (
          <div className="mb-2 text-xs text-gray-600 px-0.5">
            Sync: {new Date(syncStatus.lastSync).toLocaleString('es')}
            {syncStatus.imported.messages > 0 && ` · ${syncStatus.imported.messages} importados`}
          </div>
        )}

        {/* Filters panel */}
        {showFilters && (
          <div className="mb-2 flex flex-wrap gap-2">
            <div className="flex gap-1 flex-wrap">
              {CONV_STATUS_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setConvStatusFilter(opt.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${convStatusFilter === opt.value ? 'bg-green-500/20 border-green-600 text-green-400' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {user?.role === 'admin' && team.length > 0 && (
              <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-green-500">
                <option value="">Todos los agentes</option>
                {team.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            {(convStatusFilter || agentFilter) && (
              <button onClick={() => { setConvStatusFilter(''); setAgentFilter(''); }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-white">
                <X size={11} /> Limpiar
              </button>
            )}
          </div>
        )}

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar conversación..."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-green-500"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-800/60">
        {conversations.length === 0 && !syncStatus.running && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600">
            <MessageSquare size={36} className="mb-3 opacity-30" />
            <p className="text-sm">Sin conversaciones</p>
            <p className="text-xs mt-1 text-gray-700">Presioná "Sync" para importar el historial</p>
          </div>
        )}
        {conversations.map(c => (
          <button
            key={c.id}
            onClick={() => navigate(`/contacts/${c.id}`)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-800/50 active:bg-gray-800 transition-colors text-left ${c.sla_breach ? 'border-l-2 border-red-500' : ''}`}
          >
            <div className="relative shrink-0">
              <Avatar
                contact={c}
                size="md"
                onClick={e => { e.stopPropagation(); setLightbox(c); }}
              />
              {c.unread_count > 0 && (
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-950" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-sm font-semibold truncate ${c.unread_count > 0 ? 'text-white' : 'text-gray-300'}`}>
                    {c.name}
                  </span>
                  {c.sla_breach && <AlertTriangle size={11} className="text-red-400 shrink-0" title="SLA superado" />}
                  {c.conv_status && c.conv_status !== 'open' && (
                    <span className={`text-[10px] shrink-0 ${CONV_STATUS_COLORS[c.conv_status] || 'text-gray-500'}`}>
                      {c.conv_status === 'pending' ? '⏳' : '✓'}
                    </span>
                  )}
                </div>
                <span className={`text-xs shrink-0 ${c.unread_count > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                  {timeAgo(c.last_message_at)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className={`text-xs truncate ${c.unread_count > 0 ? 'text-gray-300' : 'text-gray-500'}`}>
                  {c.last_direction === 'outbound' && <span className="text-green-500 mr-1">✓</span>}
                  {c.assigned_name && <span className="text-blue-400 mr-1">[{c.assigned_name}]</span>}
                  {c.last_message || <span className="italic text-gray-600">Sin mensajes</span>}
                </p>
                {c.unread_count > 0 && (
                  <span className="shrink-0 bg-green-500 text-white text-[11px] font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1">
                    {c.unread_count > 99 ? '99+' : c.unread_count}
                  </span>
                )}
                {c.category_name && !c.unread_count && (
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: c.category_color + '22', color: c.category_color }}>
                    {c.category_name}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <PhotoLightbox contact={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
