import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Clock, UserCheck } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';
import { Avatar } from '../components/Avatar.jsx';

const STAGES = [
  { key: 'nuevo',        label: 'Nuevo',        color: 'bg-gray-500',   border: 'border-gray-500' },
  { key: 'contactado',   label: 'Contactado',   color: 'bg-blue-500',   border: 'border-blue-500' },
  { key: 'en_progreso',  label: 'En progreso',  color: 'bg-yellow-500', border: 'border-yellow-500' },
  { key: 'propuesta',    label: 'Propuesta',    color: 'bg-purple-500', border: 'border-purple-500' },
  { key: 'ganado',       label: 'Ganado',       color: 'bg-green-500',  border: 'border-green-500' },
  { key: 'perdido',      label: 'Perdido',      color: 'bg-red-500',    border: 'border-red-500' },
];

const CONV_STATUS_COLORS = { open: 'text-green-400', pending: 'text-yellow-400', closed: 'text-gray-500' };
const CONV_STATUS_LABELS = { open: 'Abierto', pending: 'Pendiente', closed: 'Cerrado' };

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T') + 'Z');
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function Pipeline() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const dragNode = useRef(null);

  const load = useCallback(() => {
    apiFetch('/api/contacts?limit=500&status=active')
      .then(r => r?.json())
      .then(d => { if (d) { setContacts(d.contacts ?? []); setLoading(false); } });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function moveStage(contactId, newStage) {
    setContacts(cs => cs.map(c => c.id === contactId ? { ...c, pipeline_stage: newStage } : c));
    await apiFetch(`/api/contacts/${contactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage: newStage }),
    });
  }

  // Drag handlers
  function onDragStart(e, contactId) {
    setDragId(contactId);
    dragNode.current = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => dragNode.current?.classList.add('opacity-40'), 0);
  }

  function onDragEnd() {
    dragNode.current?.classList.remove('opacity-40');
    setDragId(null);
    setDragOver(null);
    dragNode.current = null;
  }

  function onDragOver(e, stageKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(stageKey);
  }

  function onDrop(e, stageKey) {
    e.preventDefault();
    if (dragId && stageKey) {
      moveStage(dragId, stageKey);
    }
    setDragOver(null);
  }

  const grouped = STAGES.map(s => ({
    ...s,
    contacts: contacts.filter(c => (c.pipeline_stage || 'nuevo') === s.key),
  }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-gray-900 border-b border-gray-800 px-4 md:px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Pipeline</h1>
          <span className="text-xs text-gray-500">{contacts.length} contactos activos</span>
        </div>
        <div className="flex gap-3 mt-3 overflow-x-auto pb-1">
          {STAGES.map(s => {
            const count = contacts.filter(c => (c.pipeline_stage || 'nuevo') === s.key).length;
            return (
              <div key={s.key} className="flex items-center gap-1.5 shrink-0">
                <div className={`w-2 h-2 rounded-full ${s.color}`} />
                <span className="text-xs text-gray-400">{s.label}</span>
                <span className="text-xs font-bold text-white bg-gray-800 px-1.5 rounded">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Cargando...</div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full gap-3 p-4 min-w-max">
            {grouped.map(stage => (
              <div
                key={stage.key}
                className={`w-64 flex flex-col bg-gray-900 border rounded-xl overflow-hidden shrink-0 transition-colors ${
                  dragOver === stage.key ? `${stage.border} bg-gray-800/50` : 'border-gray-800'
                }`}
                onDragOver={e => onDragOver(e, stage.key)}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => onDrop(e, stage.key)}
              >
                {/* Column header */}
                <div className="px-3 py-2.5 border-b border-gray-800 flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                  <span className="text-xs font-semibold text-gray-300 flex-1">{stage.label}</span>
                  <span className="text-xs font-bold text-white bg-gray-800 px-1.5 rounded">{stage.contacts.length}</span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {stage.contacts.map(c => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={e => onDragStart(e, c.id)}
                      onDragEnd={onDragEnd}
                      className="bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-grab active:cursor-grabbing select-none"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar contact={c} size="xs" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                          <p className="text-[10px] text-gray-500 font-mono truncate">{c.phone}</p>
                        </div>
                        <button
                          onClick={() => navigate(`/contacts/${c.id}`)}
                          className="p-1 text-green-500 hover:bg-green-500/10 rounded"
                          title="Abrir chat"
                        >
                          <MessageCircle size={14} />
                        </button>
                      </div>

                      {/* Category & conv status row */}
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {c.category_name && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: c.category_color + '22', color: c.category_color }}>
                            {c.category_name}
                          </span>
                        )}
                        {c.conv_status && (
                          <span className={`text-[10px] ${CONV_STATUS_COLORS[c.conv_status] || 'text-gray-500'}`}>
                            {CONV_STATUS_LABELS[c.conv_status] || c.conv_status}
                          </span>
                        )}
                      </div>

                      {/* Agent & last message time */}
                      <div className="flex items-center justify-between gap-1">
                        {c.assigned_name ? (
                          <span className="text-[10px] text-blue-400 flex items-center gap-0.5 truncate">
                            <UserCheck size={9} /> {c.assigned_name}
                          </span>
                        ) : <span />}
                        {c.updated_at && (
                          <span className="text-[10px] text-gray-600 flex items-center gap-0.5 shrink-0">
                            <Clock size={9} /> {timeAgo(c.updated_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {stage.contacts.length === 0 && (
                    <div className={`text-[11px] text-gray-700 text-center py-8 border-2 border-dashed rounded-lg transition-colors ${dragOver === stage.key ? 'border-gray-500 text-gray-500' : 'border-gray-800'}`}>
                      {dragOver === stage.key ? 'Soltar aquí' : 'Sin contactos'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
