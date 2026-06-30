import { useState, useEffect, useRef } from 'react';
import { Search, MessageSquare, User, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiFetch.js';

function highlight(text, query) {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/30 text-yellow-300 rounded">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounce = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      const r = await apiFetch(`/api/messages/search?q=${encodeURIComponent(query)}&limit=40`);
      const d = await r?.json();
      setLoading(false);
      if (Array.isArray(d)) setResults(d);
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [query]);

  const grouped = results.reduce((acc, msg) => {
    const key = msg.contact_id;
    if (!acc[key]) acc[key] = { contact_name: msg.contact_name, contact_phone: msg.contact_phone, contact_id: msg.contact_id, messages: [] };
    acc[key].messages.push(msg);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-5">
        <Search size={20} className="text-blue-400" />
        <h1 className="text-xl font-bold text-white">Búsqueda global</h1>
      </div>

      <div className="relative mb-5">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar en todos los mensajes..."
          className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {query && !loading && results.length === 0 && (
        <p className="text-gray-600 text-sm text-center py-8">Sin resultados para "{query}"</p>
      )}

      <div className="space-y-4">
        {Object.values(grouped).map(group => (
          <div key={group.contact_id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => navigate(`/contacts/${group.contact_id}`)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800 transition-colors border-b border-gray-800"
            >
              <div className="flex items-center gap-2">
                <User size={15} className="text-gray-500" />
                <span className="text-sm font-semibold text-white">{group.contact_name}</span>
                <span className="text-xs text-gray-500">{group.contact_phone}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                <span>{group.messages.length} resultado{group.messages.length !== 1 ? 's' : ''}</span>
                <ArrowRight size={12} />
              </div>
            </button>
            {group.messages.slice(0, 3).map(msg => (
              <button
                key={msg.id}
                onClick={() => navigate(`/contacts/${msg.contact_id}`)}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-800/50 transition-colors border-b border-gray-800/50 last:border-0"
              >
                <div className="flex items-start gap-2">
                  <MessageSquare size={13} className={`shrink-0 mt-0.5 ${msg.direction === 'outbound' ? 'text-green-500' : 'text-gray-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 truncate">{highlight(msg.content, query)}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {new Date(msg.sent_at.replace(' ', 'T') + 'Z').toLocaleString('es')}
                      {' · '}{msg.direction === 'outbound' ? 'Enviado' : 'Recibido'}
                    </p>
                  </div>
                </div>
              </button>
            ))}
            {group.messages.length > 3 && (
              <button onClick={() => navigate(`/contacts/${group.contact_id}`)}
                className="w-full px-4 py-2 text-xs text-gray-600 hover:text-gray-400 text-center hover:bg-gray-800/30 transition-colors">
                +{group.messages.length - 3} más
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
