import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, MessageSquare, RefreshCw, AlertTriangle, Filter, X, Send, UserCheck, ChevronDown } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';
import { Avatar, PhotoLightbox } from '../components/Avatar.jsx';
import InboxChatPanel from '../components/InboxChatPanel.jsx';
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
  const check = useCallback(() => { apiFetch('/api/sync').then(r => r?.json()).then(d => d && setStatus(d)).catch(() => {}); }, []);
  const startSync = useCallback(async () => {
    await apiFetch('/api/sync', { method: 'POST' });
    check();
    polling.current = setInterval(() => {
      apiFetch('/api/sync').then(r => r?.json()).then(d => {
        if (!d) return; setStatus(d);
        if (!d.running) clearInterval(polling.current);
      }).catch(() => {});
    }, 2000);
  }, [check]);
  useEffect(() => { check(); return () => clearInterval(polling.current); }, [check]);
  return { status, startSync };
}

const CONV_STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'open', label: 'Abierto' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'closed', label: 'Cerrado' },
];

const CONV_STATUS_COLORS = { open: 'text-green-400', pending: 'text-yellow-400', closed: 'text-gray-500' };
const CONV_STATUS_BG = { open: 'bg-green-500/10 border-green-700 text-green-400', pending: 'bg-yellow-500/10 border-yellow-700 text-yellow-400', closed: 'bg-gray-500/10 border-gray-700 text-gray-400' };

function QuickReplyModal({ contact, onClose, onSent }) {
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function send(e) {
    e.preventDefault();
    if (!msg.trim()) return;
    setSending(true); setError('');
    const r = await apiFetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contact.id, message: msg }),
    });
    setSending(false);
    if (r?.ok) { onSent(); onClose(); }
    else { const d = await r?.json(); setError(d?.error || 'Error al enviar'); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 px-3 pb-20 md:pb-0" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white">
            {(contact.name || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{contact.name}</p>
            <p className="text-xs text-gray-500">{contact.phone}</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white"><X size={15} /></button>
        </div>
        <form onSubmit={send} className="flex gap-2">
          <input autoFocus required value={msg} onChange={e => setMsg(e.target.value)}
            placeholder="Escribe tu respuesta..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
          <button type="submit" disabled={sending || !msg.trim()}
            className="p-2.5 bg-green-500 hover:bg-green-400 disabled:opacity-50 rounded-xl text-white transition-colors">
            <Send size={15} />
          </button>
        </form>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
    </div>
  );
}

export default function InboxPage() {
  const navigate = useNavigate();
  const { selectedId: selectedIdParam } = useParams();
  const selectedId = selectedIdParam ? parseInt(selectedIdParam) : null;

  const { user, token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [convStatusFilter, setConvStatusFilter] = useState('open');
  const [agentFilter, setAgentFilter] = useState('');
  const [team, setTeam] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [quickReply, setQuickReply] = useState(null);
  const [statusMenuId, setStatusMenuId] = useState(null);
  const [assignMenuId, setAssignMenuId] = useState(null);
  const { status: syncStatus, startSync } = useSyncStatus();
  const sseDebounce = useRef(null);

  const PAGE_SIZE = 40;
  const loadPage = useCallback((p, append = false, sseUpdate = false) => {
    const params = new URLSearchParams({ page: p, limit: PAGE_SIZE });
    if (search) params.set('search', search);
    if (convStatusFilter) params.set('conv_status', convStatusFilter);
    if (agentFilter) params.set('assigned_to', agentFilter);
    apiFetch(`/api/inbox?${params}`).then(r => r?.json()).then(data => {
      if (!data) return;
      if (append) {
        setConversations(prev => {
          const ids = new Set(prev.map(c => c.id));
          return [...prev, ...(data.conversations ?? []).filter(c => !ids.has(c.id))];
        });
      } else if (sseUpdate) {
        // Merge: place fresh page-1 at top, keep any already-loaded later-page items below.
        // This prevents a contact that moved from page 2 → page 1 from appearing twice,
        // and avoids wiping extra items the user loaded with "Cargar más".
        setConversations(prev => {
          const fresh = data.conversations ?? [];
          const freshIds = new Set(fresh.map(c => c.id));
          const rest = prev.filter(c => !freshIds.has(c.id));
          return [...fresh, ...rest];
        });
      } else {
        setConversations(data.conversations ?? []);
        setPage(1);
      }
      setTotal(data.total ?? 0);
    }).catch(() => {});
  }, [search, convStatusFilter, agentFilter]);

  const load = useCallback(() => loadPage(1, false, false), [loadPage]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!token) return;
    const es = new EventSource(`/api/sse?token=${encodeURIComponent(token)}`);
    es.addEventListener('message', () => {
      clearTimeout(sseDebounce.current);
      sseDebounce.current = setTimeout(() => loadPage(1, false, true), 150);
    });
    es.onerror = () => {};
    return () => { es.close(); clearTimeout(sseDebounce.current); };
  }, [token, loadPage]);

  useEffect(() => {
    if (user?.role === 'admin') {
      apiFetch('/api/team').then(r => r?.json()).then(d => d && setTeam(Array.isArray(d) ? d : []));
    }
  }, [user]);

  const wasSyncing = useRef(false);
  useEffect(() => { if (wasSyncing.current && !syncStatus.running) load(); wasSyncing.current = syncStatus.running; }, [syncStatus.running, load]);

  async function markUnread(contactId, e) {
    e.stopPropagation();
    await apiFetch(`/api/inbox/${contactId}/unread`, { method: 'PATCH' });
    setConversations(prev => prev.map(c => c.id === contactId ? { ...c, unread_count: (c.unread_count || 0) + 1 } : c));
  }

  async function updateStatus(contactId, conv_status, e) {
    e.stopPropagation();
    setStatusMenuId(null);
    await apiFetch(`/api/contacts/${contactId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conv_status }) });
    setConversations(prev => prev.map(c => c.id === contactId ? { ...c, conv_status } : c));
  }

  async function updateAssign(contactId, assigned_to, e) {
    e.stopPropagation();
    setAssignMenuId(null);
    const agentName = team.find(a => a.id === parseInt(assigned_to))?.name || null;
    await apiFetch(`/api/contacts/${contactId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigned_to: assigned_to || null }) });
    setConversations(prev => prev.map(c => c.id === contactId ? { ...c, assigned_to: assigned_to || null, assigned_name: agentName } : c));
  }

  useEffect(() => {
    if (statusMenuId === null && assignMenuId === null) return;
    const close = () => { setStatusMenuId(null); setAssignMenuId(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [statusMenuId, assignMenuId]);

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);
  const slaBreaches = conversations.filter(c => c.sla_breach).length;

  const listPanel = (
    <div className={`flex flex-col h-full border-r border-gray-800 bg-gray-950 ${
      selectedId ? 'hidden md:flex md:w-80 xl:w-96 shrink-0' : 'flex-1'
    }`}>
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 sticky top-0 z-10 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Bandeja</h1>
            {totalUnread > 0 && <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{totalUnread}</span>}
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
              {(convStatusFilter || agentFilter) ? 'Activos' : 'Filtrar'}
            </button>
            <button onClick={startSync} disabled={syncStatus.running} title="Sincronizar"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              <RefreshCw size={13} className={syncStatus.running ? 'animate-spin' : ''} />
              {syncStatus.running ? 'Sync...' : 'Sync'}
            </button>
          </div>
        </div>

        {syncStatus.running && <div className="mb-2 text-xs text-gray-500 px-0.5">Importando... {syncStatus.imported.contacts} contactos · {syncStatus.imported.messages} mensajes</div>}

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
              <button onClick={() => { setConvStatusFilter(''); setAgentFilter(''); }} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white">
                <X size={11} /> Limpiar
              </button>
            )}
          </div>
        )}

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conversación..."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-green-500" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-800/60">
        {conversations.length === 0 && !syncStatus.running && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600">
            <MessageSquare size={36} className="mb-3 opacity-30" />
            <p className="text-sm">Sin conversaciones</p>
            <p className="text-xs mt-1 text-gray-700">Presiona "Sync" para importar el historial</p>
          </div>
        )}
        {conversations.map(c => (
          <div key={c.id}
            onClick={() => navigate(`/inbox/${c.id}`)}
            className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-800/50 transition-colors cursor-pointer ${c.sla_breach ? 'border-l-2 border-red-500' : ''} ${selectedId === c.id ? 'bg-gray-800/70 border-l-2 border-green-500' : ''}`}>

            <div className="relative shrink-0" onClick={e => { e.stopPropagation(); setLightbox(c); }}>
              <Avatar contact={c} size="md" />
              {c.unread_count > 0 && <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-950" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-sm font-semibold truncate ${c.unread_count > 0 ? 'text-white' : 'text-gray-300'}`}>{c.name}</span>
                  {c.category_name && <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: (c.category_color || '#6b7280') + '33', color: c.category_color || '#6b7280' }}>{c.category_name}</span>}
                  {c.sla_breach && <AlertTriangle size={11} className="text-red-400 shrink-0" />}
                </div>
                <span className={`text-xs shrink-0 ${c.unread_count > 0 ? 'text-green-400' : 'text-gray-600'}`}>{timeAgo(c.last_message_at)}</span>
              </div>
              <p className={`text-xs truncate ${c.unread_count > 0 ? 'text-gray-300' : 'text-gray-500'}`}>
                {c.last_direction === 'outbound' && <span className="text-green-500 mr-1">✓</span>}
                {c.last_message || <span className="italic text-gray-600">Sin mensajes</span>}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
              {c.unread_count > 0 && (
                <span className="bg-green-500 text-white text-[11px] font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1 mr-1">
                  {c.unread_count > 99 ? '99+' : c.unread_count}
                </span>
              )}

              <button onClick={e => { e.stopPropagation(); setQuickReply(c); }}
                title="Responder rápido"
                className="p-1.5 text-gray-600 hover:text-green-400 transition-colors rounded-lg hover:bg-gray-800">
                <Send size={13} />
              </button>
              {c.unread_count === 0 && (
                <button onClick={e => markUnread(c.id, e)}
                  title="Marcar como no leído"
                  className="p-1.5 text-gray-700 hover:text-yellow-400 transition-colors rounded-lg hover:bg-gray-800">
                  <MessageSquare size={13} />
                </button>
              )}

              <div className="relative">
                <button onClick={e => { e.stopPropagation(); setStatusMenuId(statusMenuId === c.id ? null : c.id); setAssignMenuId(null); }}
                  className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${CONV_STATUS_BG[c.conv_status] || 'bg-gray-700 text-gray-400 border-gray-600'}`}>
                  {c.conv_status === 'open' ? '●' : c.conv_status === 'pending' ? '⏳' : '✓'}
                  <ChevronDown size={9} />
                </button>
                {statusMenuId === c.id && (
                  <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden w-32">
                    {['open', 'pending', 'closed'].map(s => (
                      <button key={s} onClick={e => updateStatus(c.id, s, e)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors ${CONV_STATUS_COLORS[s]}`}>
                        {s === 'open' ? '● Abierto' : s === 'pending' ? '⏳ Pendiente' : '✓ Cerrado'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {user?.role === 'admin' && team.length > 0 && (
                <div className="relative">
                  <button onClick={e => { e.stopPropagation(); setAssignMenuId(assignMenuId === c.id ? null : c.id); setStatusMenuId(null); }}
                    title={c.assigned_name || 'Sin asignar'}
                    className="p-1.5 text-gray-600 hover:text-blue-400 transition-colors rounded-lg hover:bg-gray-800">
                    <UserCheck size={13} />
                  </button>
                  {assignMenuId === c.id && (
                    <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden w-40">
                      <button onClick={e => updateAssign(c.id, '', e)}
                        className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-700">
                        Sin asignar
                      </button>
                      {team.map(a => (
                        <button key={a.id} onClick={e => updateAssign(c.id, a.id, e)}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors ${c.assigned_to === a.id ? 'text-blue-400 font-medium' : 'text-gray-300'}`}>
                          {a.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {conversations.length < total && (
          <button
            onClick={() => { const next = page + 1; setPage(next); loadPage(next, true); }}
            className="w-full py-3 text-xs text-gray-500 hover:text-white hover:bg-gray-800/50 transition-colors">
            Cargar más ({conversations.length} de {total})
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden">
      {listPanel}

      {/* Right panel: chat — desktop always, mobile only when selected */}
      <div className={`flex-1 h-full overflow-hidden ${selectedId ? 'flex flex-col' : 'hidden md:flex'}`}>
        {selectedId ? (
          <InboxChatPanel
            contactId={selectedId}
            onClose={() => navigate('/inbox')}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-700 bg-gray-950">
            <MessageSquare size={40} className="mb-3 opacity-20" />
            <p className="text-sm">Selecciona una conversación</p>
          </div>
        )}
      </div>

      <PhotoLightbox contact={lightbox} onClose={() => setLightbox(null)} />
      {quickReply && <QuickReplyModal contact={quickReply} onClose={() => setQuickReply(null)} onSent={load} />}
    </div>
  );
}
