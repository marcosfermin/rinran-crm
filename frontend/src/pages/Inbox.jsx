import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageSquare } from 'lucide-react';

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

export default function InboxPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    fetch(`/api/inbox?${params}`)
      .then(r => r.json())
      .then(setConversations)
      .catch(() => {});
  }, [search]);

  useEffect(() => { load(); }, [load]);

  // Poll for new messages every 8 seconds
  useEffect(() => {
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);

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
          </div>
        </div>
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
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600">
            <MessageSquare size={36} className="mb-3 opacity-30" />
            <p className="text-sm">Sin conversaciones aún</p>
            <p className="text-xs mt-1 text-gray-700">Los mensajes de WhatsApp aparecerán aquí</p>
          </div>
        )}
        {conversations.map(c => (
          <button
            key={c.id}
            onClick={() => navigate(`/contacts/${c.id}`)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-800/50 active:bg-gray-800 transition-colors text-left"
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-2xl">
                {c.country_flag || '👤'}
              </div>
              {c.unread_count > 0 && (
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-950" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <span className={`text-sm font-semibold truncate ${c.unread_count > 0 ? 'text-white' : 'text-gray-300'}`}>
                  {c.name}
                </span>
                <span className={`text-xs shrink-0 ${c.unread_count > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                  {timeAgo(c.last_message_at)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className={`text-xs truncate ${c.unread_count > 0 ? 'text-gray-300' : 'text-gray-500'}`}>
                  {c.last_direction === 'outbound' && <span className="text-green-500 mr-1">✓</span>}
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
    </div>
  );
}
