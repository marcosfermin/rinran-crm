import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';

export default function Contacts() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', category_id: '', notes: '' });
  const limit = 20;

  const load = useCallback(() => {
    const params = new URLSearchParams({ page, limit });
    if (search) params.set('search', search);
    if (categoryFilter) params.set('category_id', categoryFilter);
    fetch(`/api/contacts?${params}`)
      .then(r => r.json())
      .then(d => { setContacts(d.contacts); setTotal(d.total); });
  }, [search, categoryFilter, page]);

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(setCategories);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addContact(e) {
    e.preventDefault();
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowAdd(false);
      setForm({ name: '', phone: '', category_id: '', notes: '' });
      load();
    }
  }

  async function deleteContact(id, e) {
    e.stopPropagation();
    if (!confirm('¿Eliminar contacto?')) return;
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    load();
  }

  const pages = Math.ceil(total / limit);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">
          Contactos <span className="text-gray-500 text-base font-normal">({total})</span>
        </h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Agregar
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-green-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-green-500 max-w-[130px]"
        >
          <option value="">Todas</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Mobile: card list / Desktop: table */}
      <>
        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {contacts.map(c => (
            <div
              key={c.id}
              onClick={() => navigate(`/contacts/${c.id}`)}
              className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer active:bg-gray-800"
            >
              <div className="text-2xl shrink-0">{c.country_flag || '🏳️'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                <p className="text-xs text-gray-500 font-mono truncate">{c.phone}</p>
                {c.category_name && (
                  <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: c.category_color + '22', color: c.category_color }}>
                    {c.category_name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/contacts/${c.id}`); }}
                  className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg"
                >
                  <MessageCircle size={16} />
                </button>
                <button
                  onClick={e => deleteContact(c.id, e)}
                  className="p-2 text-gray-600 hover:text-red-400 rounded-lg"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {!contacts.length && (
            <p className="text-center text-gray-600 py-10 text-sm">Sin contactos</p>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Contacto</th>
                <th className="text-left px-4 py-3">Teléfono</th>
                <th className="text-left px-4 py-3">País</th>
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-left px-4 py-3">Fuente</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/contacts/${c.id}`)}
                  className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono">{c.phone}</td>
                  <td className="px-4 py-3">
                    <span title={c.country_name} className="text-xl">{c.country_flag || '🏳️'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {c.category_name
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: c.category_color + '33', color: c.category_color }}>
                          {c.category_name}
                        </span>
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      c.source === 'whatsapp' ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-400'
                    }`}>
                      {c.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => deleteContact(c.id, e)}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {!contacts.length && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-600">Sin contactos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Página {page} de {pages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="p-1.5 hover:text-white disabled:opacity-30 border border-gray-700 rounded-lg">
              <ChevronLeft size={16} />
            </button>
            <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
              className="p-1.5 hover:text-white disabled:opacity-30 border border-gray-700 rounded-lg">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-t-2xl md:rounded-xl p-5 w-full md:max-w-md">
            <h2 className="text-base font-bold text-white mb-4">Nuevo contacto</h2>
            <form onSubmit={addContact} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nombre *</label>
                <input required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Teléfono * (con código de país)</label>
                <input required value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+52 55 1234 5678"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Categoría</label>
                <select value={form.category_id}
                  onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500">
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Notas</label>
                <textarea value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-300 hover:bg-gray-800">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-medium">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
