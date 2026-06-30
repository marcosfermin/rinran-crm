import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, Key, Globe, Clock, AlertTriangle, Webhook, Plus, Trash2, CheckCircle } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState({ text: '', ok: false });

  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState('');

  const [customFields, setCustomFields] = useState([]);
  const [newField, setNewField] = useState({ name: '', field_type: 'text' });

  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState({ name: '', color: '#6366f1' });

  useEffect(() => {
    apiFetch('/api/settings').then(r => r?.json()).then(d => {
      if (d) { setSettings(d); setForm(d); }
    });
    apiFetch('/api/settings/custom-fields').then(r => r?.json()).then(d => d && setCustomFields(Array.isArray(d) ? d : []));
    apiFetch('/api/tags').then(r => r?.json()).then(d => d && setTags(Array.isArray(d) ? d : []));
  }, []);

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);
    const r = await apiFetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await r?.json();
    setSaving(false);
    if (r?.ok) { setSettings(d); setSavedMsg('Guardado'); setTimeout(() => setSavedMsg(''), 3000); }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwd.new_password !== pwd.confirm) { setPwdMsg({ text: 'Las contraseñas no coinciden', ok: false }); return; }
    const r = await apiFetch('/api/settings/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: pwd.current_password, new_password: pwd.new_password }) });
    const d = await r?.json();
    if (r?.ok) { setPwd({ current_password: '', new_password: '', confirm: '' }); setPwdMsg({ text: 'Contraseña actualizada', ok: true }); }
    else setPwdMsg({ text: d?.error || 'Error', ok: false });
    setTimeout(() => setPwdMsg({ text: '', ok: false }), 4000);
  }

  async function testWebhook() {
    setWebhookTesting(true); setWebhookMsg('');
    const r = await apiFetch('/api/settings/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ webhook_url: form.webhook_url }) });
    const d = await r?.json();
    setWebhookMsg(r?.ok ? `Webhook configurado en sesión "${d.session}"` : (d?.error || 'Error'));
    setWebhookTesting(false);
    setTimeout(() => setWebhookMsg(''), 5000);
  }

  async function addCustomField() {
    if (!newField.name.trim()) return;
    const r = await apiFetch('/api/settings/custom-fields', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newField) });
    const d = await r?.json();
    if (r?.ok) { setCustomFields(prev => [...prev, d]); setNewField({ name: '', field_type: 'text' }); }
  }

  async function deleteCustomField(id) {
    if (!confirm('¿Eliminar campo?')) return;
    await apiFetch(`/api/settings/custom-fields/${id}`, { method: 'DELETE' });
    setCustomFields(prev => prev.filter(f => f.id !== id));
  }

  async function addTag() {
    if (!newTag.name.trim()) return;
    const r = await apiFetch('/api/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTag) });
    const d = await r?.json();
    if (r?.ok) { setTags(prev => [...prev, d]); setNewTag({ name: '', color: '#6366f1' }); }
  }

  async function deleteTag(id) {
    if (!confirm('¿Eliminar tag?')) return;
    await apiFetch(`/api/tags/${id}`, { method: 'DELETE' });
    setTags(prev => prev.filter(t => t.id !== id));
  }

  if (!settings) return <div className="flex items-center justify-center h-full text-gray-600"><div className="animate-pulse">Cargando...</div></div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <SettingsIcon size={20} className="text-gray-400" />
        <h1 className="text-xl font-bold text-white">Configuración</h1>
      </div>

      {/* General settings (admin only) */}
      {isAdmin && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2"><Globe size={14} /> General</h2>
          <form onSubmit={saveSettings} className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre de empresa</label>
              <input value={form.company_name || ''} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Zona horaria</label>
              <input value={form.timezone || ''} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                placeholder="America/Mexico_City"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1"><Clock size={11} /> Inicio horario</label>
                <input type="time" value={form.business_hours_start || '09:00'} onChange={e => setForm(f => ({ ...f, business_hours_start: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1"><Clock size={11} /> Fin horario</label>
                <input type="time" value={form.business_hours_end || '18:00'} onChange={e => setForm(f => ({ ...f, business_hours_end: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1"><AlertTriangle size={11} /> SLA — horas máximas sin respuesta</label>
              <input type="number" min="1" max="168" value={form.sla_hours || '4'} onChange={e => setForm(f => ({ ...f, sla_hours: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
              </button>
              {savedMsg && <span className="text-green-400 text-sm flex items-center gap-1"><CheckCircle size={13} /> {savedMsg}</span>}
            </div>
          </form>
        </section>
      )}

      {/* Webhook config (admin only) */}
      {isAdmin && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2"><Webhook size={14} /> Webhook WhatsApp</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">URL del webhook</label>
              <input value={form.webhook_url || ''} onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
                placeholder="https://tu-servidor.com/webhook"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
              <p className="text-[11px] text-gray-600 mt-1">WAHA enviará los eventos de mensajes a esta URL</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={testWebhook} disabled={webhookTesting || !form.webhook_url}
                className="flex items-center gap-1.5 border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-40">
                {webhookTesting ? <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Webhook size={14} />}
                Configurar en WAHA
              </button>
              {webhookMsg && <span className={`text-sm ${webhookMsg.includes('Error') || webhookMsg.includes('error') ? 'text-red-400' : 'text-green-400'}`}>{webhookMsg}</span>}
            </div>
          </div>
        </section>
      )}

      {/* Change password */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2"><Key size={14} /> Cambiar contraseña</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Contraseña actual</label>
            <input type="password" required value={pwd.current_password} onChange={e => setPwd(p => ({ ...p, current_password: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Nueva contraseña</label>
            <input type="password" required minLength={6} value={pwd.new_password} onChange={e => setPwd(p => ({ ...p, new_password: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Confirmar contraseña</label>
            <input type="password" required value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
          </div>
          {pwdMsg.text && <p className={`text-sm ${pwdMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{pwdMsg.text}</p>}
          <button type="submit"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Key size={14} /> Actualizar contraseña
          </button>
        </form>
      </section>

      {/* Tags management (admin only) */}
      {isAdmin && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Tags</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map(t => (
              <div key={t.id} className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: t.color + '22', color: t.color, border: `1px solid ${t.color}44` }}>
                {t.name}
                <button onClick={() => deleteTag(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400">
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
            {!tags.length && <p className="text-xs text-gray-600">Sin tags</p>}
          </div>
          <div className="flex gap-2">
            <input value={newTag.name} onChange={e => setNewTag(n => ({ ...n, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              placeholder="Nombre del tag..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            <input type="color" value={newTag.color} onChange={e => setNewTag(n => ({ ...n, color: e.target.value }))}
              className="w-10 h-10 rounded-lg cursor-pointer bg-gray-800 border border-gray-700 p-1" />
            <button onClick={addTag} className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors">
              <Plus size={14} /> Agregar
            </button>
          </div>
        </section>
      )}

      {/* Custom fields (admin only) */}
      {isAdmin && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Campos personalizados en contactos</h2>
          <div className="space-y-2 mb-4">
            {customFields.map(f => (
              <div key={f.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2.5">
                <div className="flex-1">
                  <p className="text-sm text-white">{f.name}</p>
                  <p className="text-xs text-gray-500">{f.field_type}</p>
                </div>
                <button onClick={() => deleteCustomField(f.id)} className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {!customFields.length && <p className="text-xs text-gray-600">Sin campos personalizados</p>}
          </div>
          <div className="flex gap-2">
            <input value={newField.name} onChange={e => setNewField(n => ({ ...n, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addCustomField()}
              placeholder="Nombre del campo..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            <select value={newField.field_type} onChange={e => setNewField(n => ({ ...n, field_type: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="date">Fecha</option>
              <option value="url">URL</option>
            </select>
            <button onClick={addCustomField} className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors">
              <Plus size={14} /> Agregar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
