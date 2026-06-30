import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, ChevronLeft, ChevronRight, MessageCircle, Upload, Download, CheckSquare, Square, Users, Tag, GitBranch, UserCheck, X, BookmarkPlus, Bookmark, Merge } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';
import { Avatar, PhotoLightbox } from '../components/Avatar.jsx';

const STAGES = ['nuevo', 'contactado', 'en_progreso', 'propuesta', 'ganado', 'perdido'];
const STAGE_LABELS = { nuevo: 'Nuevo', contactado: 'Contactado', en_progreso: 'En progreso', propuesta: 'Propuesta', ganado: 'Ganado', perdido: 'Perdido' };
const CONV_STATUS_LABELS = { open: 'Abierto', pending: 'Pendiente', closed: 'Cerrado' };

export default function Contacts() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [team, setTeam] = useState([]);
  const [savedFilters, setSavedFilters] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [convStatusFilter, setConvStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', category_id: '', notes: '' });
  const [lightbox, setLightbox] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [showBulk, setShowBulk] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [showMerge, setShowMerge] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [tagFilter, setTagFilter] = useState('');
  const [allTags, setAllTags] = useState([]);
  const csvInputRef = useRef(null);
  const limit = 20;

  const load = useCallback(() => {
    const params = new URLSearchParams({ page, limit });
    if (search) params.set('search', search);
    if (categoryFilter) params.set('category_id', categoryFilter);
    if (stageFilter) params.set('pipeline_stage', stageFilter);
    if (convStatusFilter) params.set('conv_status', convStatusFilter);
    apiFetch(`/api/contacts?${params}`).then(r => r?.json()).then(d => {
      if (!d) return;
      let list = d.contacts ?? [];
      // Client-side tag filter (backend doesn't support it yet via query)
      if (tagFilter) list = list.filter(c => c.tags?.some(t => t.id === parseInt(tagFilter)));
      setContacts(list);
      setTotal(tagFilter ? list.length : (d.total ?? 0));
    });
    setSelected(new Set());
  }, [search, categoryFilter, stageFilter, convStatusFilter, tagFilter, page]);

  useEffect(() => {
    apiFetch('/api/categories').then(r => r?.json()).then(d => d && setCategories(Array.isArray(d) ? d : []));
    apiFetch('/api/team').then(r => r?.json()).then(d => d && setTeam(Array.isArray(d) ? d : []));
    apiFetch('/api/saved-filters').then(r => r?.json()).then(d => d && setSavedFilters(Array.isArray(d) ? d : []));
    apiFetch('/api/tags').then(r => r?.json()).then(d => d && setAllTags(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addContact(e) {
    e.preventDefault();
    const res = await apiFetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res?.ok) { setShowAdd(false); setForm({ name: '', phone: '', category_id: '', notes: '' }); load(); }
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryFilter) params.set('category_id', categoryFilter);
    window.location.href = `/api/contacts/export?${params}`;
  }

  async function importCsv(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const csv = await file.text();
    const r = await apiFetch('/api/contacts/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv }) });
    const d = await r?.json();
    setImportResult(d);
    if (d?.imported > 0) load();
    e.target.value = '';
    setTimeout(() => setImportResult(null), 6000);
  }

  async function deleteContact(id, e) {
    e.stopPropagation();
    if (!confirm('¿Eliminar contacto?')) return;
    await apiFetch(`/api/contacts/${id}`, { method: 'DELETE' });
    load();
  }

  function toggleSelect(id, e) {
    e.stopPropagation();
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function selectAll() {
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map(c => c.id)));
  }

  async function applyBulk() {
    if (!bulkAction || !selected.size) return;
    await apiFetch('/api/contacts/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...selected], action: bulkAction, value: bulkValue || null }) });
    setShowBulk(false); setBulkAction(''); setBulkValue(''); load();
  }

  async function saveFilter() {
    if (!filterName.trim()) return;
    const filters = {};
    if (search) filters.search = search;
    if (categoryFilter) filters.category_id = categoryFilter;
    if (stageFilter) filters.pipeline_stage = stageFilter;
    if (convStatusFilter) filters.conv_status = convStatusFilter;
    await apiFetch('/api/saved-filters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: filterName, filters }) });
    apiFetch('/api/saved-filters').then(r => r?.json()).then(d => d && setSavedFilters(Array.isArray(d) ? d : []));
    setShowSaveFilter(false); setFilterName('');
  }

  async function deleteFilter(id, e) {
    e.stopPropagation();
    await apiFetch(`/api/saved-filters/${id}`, { method: 'DELETE' });
    setSavedFilters(prev => prev.filter(f => f.id !== id));
  }

  function applyFilter(f) {
    const filters = JSON.parse(f.filters_json);
    setSearch(filters.search || '');
    setCategoryFilter(filters.category_id || '');
    setStageFilter(filters.pipeline_stage || '');
    setConvStatusFilter(filters.conv_status || '');
    setPage(1);
  }

  async function loadDuplicates() {
    const r = await apiFetch('/api/contacts/duplicates');
    const d = await r?.json();
    if (Array.isArray(d)) { setDuplicates(d); setShowMerge(true); }
  }

  async function mergeContacts(keepId, mergeId) {
    await apiFetch('/api/contacts/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keep_id: keepId, merge_id: mergeId }) });
    setDuplicates(prev => prev.filter(d => d.id1 !== keepId && d.id2 !== keepId && d.id1 !== mergeId && d.id2 !== mergeId));
    load();
  }

  const pages = Math.ceil(total / limit);
  const hasFilters = search || categoryFilter || stageFilter || convStatusFilter || tagFilter;

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold text-white">Contactos <span className="text-gray-500 text-base font-normal">({total})</span></h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={loadDuplicates} title="Fusionar duplicados"
            className="flex items-center gap-1.5 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-2 rounded-xl text-sm font-medium transition-colors">
            <Merge size={15} />
          </button>
          <button onClick={exportCsv} title="Exportar CSV"
            className="flex items-center gap-1.5 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-2 rounded-xl text-sm font-medium transition-colors">
            <Download size={15} /> <span className="hidden sm:inline">Exportar</span>
          </button>
          <button onClick={() => csvInputRef.current?.click()} title="Importar CSV"
            className="flex items-center gap-1.5 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-2 rounded-xl text-sm font-medium transition-colors">
            <Upload size={15} /> <span className="hidden sm:inline">Importar</span>
          </button>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors">
            <Plus size={16} /> Agregar
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${importResult.imported > 0 ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-yellow-900/20 border-yellow-800 text-yellow-300'}`}>
          Importados: <strong>{importResult.imported}</strong> · Omitidos: <strong>{importResult.skipped}</strong>
          {importResult.errors?.length > 0 && <span className="text-red-400 ml-2">{importResult.errors[0]}</span>}
        </div>
      )}

      {/* Saved filters */}
      {savedFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {savedFilters.map(f => (
            <button key={f.id} onClick={() => applyFilter(f)}
              className="group flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2.5 py-1.5 rounded-lg text-xs text-gray-300 transition-colors">
              <Bookmark size={11} className="text-blue-400" />
              {f.name}
              <X size={11} className="text-gray-600 hover:text-red-400 ml-0.5" onClick={e => deleteFilter(f.id, e)} />
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-green-500" />
          </div>
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
            className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-green-500 max-w-[130px]">
            <option value="">Todas</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={stageFilter} onChange={e => { setStageFilter(e.target.value); setPage(1); }}
            className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-green-500">
            <option value="">Pipeline: todos</option>
            {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
          <select value={convStatusFilter} onChange={e => { setConvStatusFilter(e.target.value); setPage(1); }}
            className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-green-500">
            <option value="">Estado: todos</option>
            <option value="open">Abierto</option>
            <option value="pending">Pendiente</option>
            <option value="closed">Cerrado</option>
          </select>
          {allTags.length > 0 && (
            <select value={tagFilter} onChange={e => { setTagFilter(e.target.value); setPage(1); }}
              className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-green-500">
              <option value="">Tags: todos</option>
              {allTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          {hasFilters && (
            <>
              <button onClick={() => { if (!showSaveFilter) setShowSaveFilter(true); }}
                className="flex items-center gap-1 text-xs text-blue-400 border border-blue-800 hover:bg-blue-900/20 px-2.5 py-1.5 rounded-lg transition-colors">
                <BookmarkPlus size={12} /> Guardar filtro
              </button>
              <button onClick={() => { setSearch(''); setCategoryFilter(''); setStageFilter(''); setConvStatusFilter(''); setTagFilter(''); setPage(1); }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-white border border-gray-700 px-2.5 py-1.5 rounded-lg transition-colors">
                <X size={12} /> Limpiar
              </button>
            </>
          )}
        </div>
        {showSaveFilter && (
          <div className="flex gap-2">
            <input value={filterName} onChange={e => setFilterName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveFilter()}
              placeholder="Nombre del filtro..." autoFocus
              className="flex-1 bg-gray-900 border border-blue-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            <button onClick={saveFilter} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg">Guardar</button>
            <button onClick={() => setShowSaveFilter(false)} className="p-2 text-gray-500 hover:text-white border border-gray-700 rounded-lg"><X size={14} /></button>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-blue-900/20 border border-blue-800 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-blue-300 font-medium">{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>
          {!showBulk ? (
            <div className="flex gap-2">
              <button onClick={() => { setShowBulk(true); setBulkAction('assign_category'); }}
                className="flex items-center gap-1 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 px-2.5 py-1.5 rounded-lg"><Tag size={11} /> Categoría</button>
              <button onClick={() => { setShowBulk(true); setBulkAction('set_pipeline'); }}
                className="flex items-center gap-1 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 px-2.5 py-1.5 rounded-lg"><GitBranch size={11} /> Pipeline</button>
              <button onClick={() => { setShowBulk(true); setBulkAction('assign_agent'); }}
                className="flex items-center gap-1 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 px-2.5 py-1.5 rounded-lg"><UserCheck size={11} /> Agente</button>
              <button onClick={() => { setShowBulk(true); setBulkAction('set_conv_status'); }}
                className="flex items-center gap-1 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 px-2.5 py-1.5 rounded-lg"><CheckSquare size={11} /> Estado</button>
              <button onClick={async () => { if (!confirm(`¿Eliminar ${selected.size} contactos?`)) return; await apiFetch('/api/contacts/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...selected], action: 'delete' }) }); load(); }}
                className="flex items-center gap-1 text-xs text-red-400 bg-red-900/20 hover:bg-red-900/30 px-2.5 py-1.5 rounded-lg"><Trash2 size={11} /> Eliminar</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                <option value="assign_category">Asignar categoría</option>
                <option value="set_pipeline">Cambiar pipeline</option>
                <option value="assign_agent">Asignar agente</option>
                <option value="set_conv_status">Estado conv.</option>
              </select>
              {bulkAction === 'assign_category' && (
                <select value={bulkValue} onChange={e => setBulkValue(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              {bulkAction === 'set_pipeline' && (
                <select value={bulkValue} onChange={e => setBulkValue(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                  {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              )}
              {bulkAction === 'assign_agent' && (
                <select value={bulkValue} onChange={e => setBulkValue(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                  <option value="">Sin asignar</option>
                  {team.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
              {bulkAction === 'set_conv_status' && (
                <select value={bulkValue} onChange={e => setBulkValue(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                  <option value="open">Abierto</option>
                  <option value="pending">Pendiente</option>
                  <option value="closed">Cerrado</option>
                </select>
              )}
              <button onClick={applyBulk} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded-lg">Aplicar</button>
              <button onClick={() => setShowBulk(false)} className="p-1.5 text-gray-500 hover:text-white"><X size={13} /></button>
            </div>
          )}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-500 hover:text-white"><X size={13} /></button>
        </div>
      )}

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {contacts.map(c => (
          <div key={c.id} onClick={() => navigate(`/contacts/${c.id}`)}
            className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-3 flex items-center gap-3 cursor-pointer active:bg-gray-800">
            <div onClick={e => toggleSelect(c.id, e)} className="shrink-0">
              {selected.has(c.id) ? <CheckSquare size={18} className="text-blue-400" /> : <Square size={18} className="text-gray-700" />}
            </div>
            <Avatar contact={c} size="sm" onClick={e => { e.stopPropagation(); setLightbox(c); }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{c.name}</p>
              <p className="text-xs text-gray-500 font-mono truncate">{c.phone}</p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {c.category_name && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: c.category_color + '22', color: c.category_color }}>{c.category_name}</span>
                )}
                {c.tags?.map(t => (
                  <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: t.color + '22', color: t.color }}>{t.name}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {c.conv_status && c.conv_status !== 'open' && (
                <span className={`text-[10px] px-1 py-0.5 rounded ${c.conv_status === 'closed' ? 'bg-gray-800 text-gray-500' : 'bg-yellow-900/30 text-yellow-400'}`}>
                  {CONV_STATUS_LABELS[c.conv_status]}
                </span>
              )}
              <button onClick={e => deleteContact(c.id, e)} className="p-1.5 text-gray-600 hover:text-red-400 rounded-lg"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {!contacts.length && <p className="text-center text-gray-600 py-10 text-sm">Sin contactos</p>}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 w-8">
                <button onClick={selectAll}>
                  {selected.size === contacts.length && contacts.length > 0
                    ? <CheckSquare size={14} className="text-blue-400" />
                    : <Square size={14} />}
                </button>
              </th>
              <th className="text-left px-4 py-3">Contacto</th>
              <th className="text-left px-4 py-3">Teléfono</th>
              <th className="text-left px-4 py-3">País</th>
              <th className="text-left px-4 py-3">Categoría</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="text-left px-4 py-3">Fuente</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id} onClick={() => navigate(`/contacts/${c.id}`)}
                className={`border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors ${selected.has(c.id) ? 'bg-blue-900/10' : ''}`}>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <button onClick={e => toggleSelect(c.id, e)}>
                    {selected.has(c.id) ? <CheckSquare size={14} className="text-blue-400" /> : <Square size={14} className="text-gray-700" />}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar contact={c} size="xs" onClick={e => { e.stopPropagation(); setLightbox(c); }} />
                    <div>
                      <span className="font-medium text-white">{c.name}</span>
                      {c.assigned_name && <p className="text-[10px] text-gray-600">{c.assigned_name}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400 font-mono">{c.phone}</td>
                <td className="px-4 py-3"><span title={c.country_name} className="text-xl">{c.country_flag || '🏳️'}</span></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.category_name
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: c.category_color + '33', color: c.category_color }}>{c.category_name}</span>
                      : <span className="text-gray-600">—</span>}
                    {c.tags?.map(t => (
                      <span key={t.id} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ backgroundColor: t.color + '22', color: t.color }}>{t.name}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    c.conv_status === 'open' ? 'bg-green-900/30 text-green-400'
                    : c.conv_status === 'pending' ? 'bg-yellow-900/30 text-yellow-400'
                    : 'bg-gray-800 text-gray-500'
                  }`}>{CONV_STATUS_LABELS[c.conv_status] || c.conv_status || 'Abierto'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${c.source === 'whatsapp' ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-400'}`}>{c.source}</span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={e => deleteContact(c.id, e)} className="text-gray-600 hover:text-red-400 transition-colors p-1"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
            {!contacts.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-600">Sin contactos</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Página {page} de {pages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="p-1.5 hover:text-white disabled:opacity-30 border border-gray-700 rounded-lg"><ChevronLeft size={16} /></button>
            <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
              className="p-1.5 hover:text-white disabled:opacity-30 border border-gray-700 rounded-lg"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      <PhotoLightbox contact={lightbox} onClose={() => setLightbox(null)} />

      {/* Merge modal */}
      {showMerge && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">Contactos duplicados</h2>
              <button onClick={() => setShowMerge(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            {duplicates.length === 0
              ? <p className="text-gray-500 text-sm py-4 text-center">No se encontraron duplicados</p>
              : duplicates.map((d, i) => (
                <div key={i} className="bg-gray-800 rounded-xl p-4 mb-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{d.name1}</p>
                      <p className="text-xs text-gray-500">{d.phone1} · {d.source1}</p>
                    </div>
                    <span className="text-gray-600 text-xs">↔</span>
                    <div className="flex-1 text-right">
                      <p className="text-sm font-medium text-white">{d.name2}</p>
                      <p className="text-xs text-gray-500">{d.phone2} · {d.source2}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => mergeContacts(d.id1, d.id2)}
                      className="flex-1 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg">
                      Mantener {d.name1}
                    </button>
                    <button onClick={() => mergeContacts(d.id2, d.id1)}
                      className="flex-1 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg">
                      Mantener {d.name2}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-t-2xl md:rounded-xl p-5 w-full md:max-w-md">
            <h2 className="text-base font-bold text-white mb-4">Nuevo contacto</h2>
            <form onSubmit={addContact} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nombre *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Teléfono * (con código de país)</label>
                <input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+52 55 1234 5678"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Categoría</label>
                <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500">
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-300 hover:bg-gray-800">Cancelar</button>
                <button type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-medium">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
