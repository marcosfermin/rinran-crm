import { useState, useEffect, useRef } from 'react';
import { Search, MessageSquare, User, ArrowRight, Phone } from 'lucide-react';
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
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounce = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) { setContacts([]); setMessages([]); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      const [cRes, mRes] = await Promise.all([
        apiFetch(`/api/contacts?search=${encodeURIComponent(query)}&limit=6`),
        apiFetch(`/api/messages/search?q=${encodeURIComponent(query)}&limit=40`),
      ]);
      const [cData, mData] = await Promise.all([cRes?.json(), mRes?.json()]);
      setLoading(false);
      setContacts(Array.isArray(cData?.contacts) ? cData.contacts : []);
      setMessages(Array.isArray(mData) ? mData : []);
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [query]);

  const grouped = messages.reduce((acc, msg) => {
    const key = msg.contact_id;
    if (!acc[key]) acc[key] = { contact_name: msg.contact_name, contact_phone: msg.contact_phone, contact_id: msg.contact_id, messages: [] };
    acc[key].messages.push(msg);
    return acc;
  }, {});

  // Contacts that already appear in message results don't need to be shown again
  const msgContactIds = new Set(Object.keys(grouped).map(Number));
  const extraContacts = contacts.filter(c => !msgContactIds.has(c.id));

  const hasResults = contacts.length > 0 || messages.length > 0;

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
          placeholder="Buscar contactos y mensajes..."
          className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {query && !loading && !hasResults && (
        <p className="text-gray-600 text-sm text-center py-8">Sin resultados para "{query}"</p>
      )}

      <div className="space-y-4">
        {/* Contacts only found by name/phone (not already in message results) */}
        {extraContacts.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 px-1">Contactos</p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800">
              {extraContacts.map(c => (
                <button key={c.id} onClick={() => navigate(`/contacts/${c.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors text-left">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {(c.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{highlight(c.name, query)}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Phone size={10} /> {highlight(c.phone, query)}
                    </p>
                  </div>
                  {c.category_name && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: (c.category_color || '#6b7280') + '22', color: c.category_color || '#9ca3af' }}>
                      {c.category_name}
                    </span>
                  )}
                  <ArrowRight size={12} className="text-gray-600 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages grouped by contact */}
        {Object.values(grouped).length > 0 && (
          <div>
            {extraContacts.length > 0 && (
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 px-1">Mensajes</p>
            )}
            {Object.values(grouped).map(group => (
              <div key={group.contact_id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-3">
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
        )}
      </div>
    </div>
  );
}
