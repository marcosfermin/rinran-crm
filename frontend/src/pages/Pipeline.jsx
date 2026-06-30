import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';
import { Avatar } from '../components/Avatar.jsx';

const STAGES = [
  { key: 'nuevo',        label: 'Nuevo',        color: 'bg-gray-500' },
  { key: 'contactado',   label: 'Contactado',   color: 'bg-blue-500' },
  { key: 'en_progreso',  label: 'En progreso',  color: 'bg-yellow-500' },
  { key: 'propuesta',    label: 'Propuesta',    color: 'bg-purple-500' },
  { key: 'ganado',       label: 'Ganado',       color: 'bg-green-500' },
  { key: 'perdido',      label: 'Perdido',      color: 'bg-red-500' },
];

export default function Pipeline() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    apiFetch('/api/contacts?limit=500&status=active')
      .then(r => r?.json())
      .then(d => { if (d) { setContacts(d.contacts ?? []); setLoading(false); } });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function moveStage(contact, newStage) {
    await apiFetch(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage: newStage }),
    });
    setContacts(cs => cs.map(c => c.id === contact.id ? { ...c, pipeline_stage: newStage } : c));
  }

  const stageIndex = (stage) => STAGES.findIndex(s => s.key === (stage || 'nuevo'));

  const grouped = STAGES.map(s => ({
    ...s,
    contacts: contacts.filter(c => (c.pipeline_stage || 'nuevo') === s.key),
  }));

  const totalActive = contacts.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-gray-900 border-b border-gray-800 px-4 md:px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Pipeline</h1>
          <span className="text-xs text-gray-500">{totalActive} contactos activos</span>
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

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-3 p-4 min-w-max">
          {grouped.map((stage, si) => (
            <div key={stage.key} className="w-64 flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shrink-0">
              {/* Column header */}
              <div className="px-3 py-2.5 border-b border-gray-800 flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                <span className="text-xs font-semibold text-gray-300 flex-1">{stage.label}</span>
                <span className="text-xs font-bold text-white bg-gray-800 px-1.5 rounded">{stage.contacts.length}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {stage.contacts.map(c => (
                  <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
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

                    {c.category_name && (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium mb-2"
                        style={{ backgroundColor: c.category_color + '22', color: c.category_color }}>
                        {c.category_name}
                      </span>
                    )}

                    {/* Move buttons */}
                    <div className="flex gap-1 justify-end">
                      {si > 0 && (
                        <button
                          onClick={() => moveStage(c, STAGES[si - 1].key)}
                          title={`Mover a ${STAGES[si - 1].label}`}
                          className="flex items-center gap-0.5 text-[10px] text-gray-500 hover:text-white px-1.5 py-0.5 hover:bg-gray-700 rounded transition-colors"
                        >
                          <ChevronLeft size={10} /> {STAGES[si - 1].label}
                        </button>
                      )}
                      {si < STAGES.length - 1 && (
                        <button
                          onClick={() => moveStage(c, STAGES[si + 1].key)}
                          title={`Mover a ${STAGES[si + 1].label}`}
                          className="flex items-center gap-0.5 text-[10px] text-gray-500 hover:text-white px-1.5 py-0.5 hover:bg-gray-700 rounded transition-colors"
                        >
                          {STAGES[si + 1].label} <ChevronRight size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {stage.contacts.length === 0 && (
                  <p className="text-[11px] text-gray-700 text-center py-4">Sin contactos</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
