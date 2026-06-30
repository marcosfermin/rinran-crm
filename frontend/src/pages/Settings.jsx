import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, Key, Globe, Clock, AlertTriangle, Webhook, Plus, Trash2, CheckCircle, Shield, ShieldCheck, ShieldOff, Users2, BookOpen, ToggleLeft, ToggleRight, Mail, Database, Download, Upload, Eye, EyeOff, Copy, Link, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
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

  // 2FA state
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaSetup, setTwoFaSetup] = useState(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaMsg, setTwoFaMsg] = useState({ text: '', ok: false });
  const [disablePwd, setDisablePwd] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  // Assignment rules state
  const [rules, setRules] = useState([]);
  const [agents, setAgents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newRule, setNewRule] = useState({ name: '', category_id: '', agent_id: '' });
  const [ruleMsg, setRuleMsg] = useState('');

  // Pipeline stages state
  const [pipelineStages, setPipelineStages] = useState([]);
  const [newStage, setNewStage] = useState({ key: '', label: '', color: '#6b7280' });
  const [stageMsg, setStageMsg] = useState({ text: '', ok: false });

  // Phonebook import
  const [phonebookImporting, setPhonebookImporting] = useState(false);
  const [phonebookResult, setPhonebookResult] = useState(null);

  // SMTP
  const [smtpForm, setSmtpForm] = useState({ smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '', smtp_enabled: '0' });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpMsg, setSmtpMsg] = useState({ text: '', ok: false });
  const [smtpTestEmail, setSmtpTestEmail] = useState('');
  const [smtpShowPass, setSmtpShowPass] = useState(false);

  // Backup/Restore
  const [restoring, setRestoring] = useState(false);
  const [backupMsg, setBackupMsg] = useState({ text: '', ok: false });

  // Outbound webhooks
  const [outboundHooks, setOutboundHooks] = useState([]);
  const [newHook, setNewHook] = useState({ name: '', url: '', events: 'message.inbound', secret: '' });
  const [hookMsg, setHookMsg] = useState('');

  // API keys
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyResult, setNewKeyResult] = useState(null);
  const [keyMsg, setKeyMsg] = useState('');

  useEffect(() => {
    apiFetch('/api/settings').then(r => r?.json()).then(d => { if (d) { setSettings(d); setForm(d); } });
    apiFetch('/api/settings/custom-fields').then(r => r?.json()).then(d => d && setCustomFields(Array.isArray(d) ? d : []));
    apiFetch('/api/tags').then(r => r?.json()).then(d => d && setTags(Array.isArray(d) ? d : []));
    apiFetch('/api/auth/me').then(r => r?.json()).then(d => d?.user && setTwoFaEnabled(!!d.user.two_fa_enabled));
    if (isAdmin) {
      apiFetch('/api/settings/assignment-rules').then(r => r?.json()).then(d => d && setRules(Array.isArray(d) ? d : []));
      apiFetch('/api/team').then(r => r?.json()).then(d => d && setAgents(Array.isArray(d) ? d : []));
      apiFetch('/api/categories').then(r => r?.json()).then(d => d && setCategories(Array.isArray(d) ? d : []));
      apiFetch('/api/settings/smtp').then(r => r?.json()).then(d => d && setSmtpForm(prev => ({ ...prev, ...d })));
      apiFetch('/api/settings/outbound-webhooks').then(r => r?.json()).then(d => d && setOutboundHooks(Array.isArray(d) ? d : []));
      apiFetch('/api/settings/api-keys').then(r => r?.json()).then(d => d && setApiKeys(Array.isArray(d) ? d : []));
      apiFetch('/api/pipeline-stages').then(r => r?.json()).then(d => d && setPipelineStages(Array.isArray(d) ? d : []));
    }
  }, [isAdmin]);

  async function saveSettings(e) {
    e.preventDefault(); setSaving(true);
    const r = await apiFetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await r?.json(); setSaving(false);
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
    setWebhookTesting(false); setTimeout(() => setWebhookMsg(''), 5000);
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

  // 2FA handlers
  async function setup2FA() {
    const r = await apiFetch('/api/auth/2fa/setup');
    const d = await r?.json();
    if (d) setTwoFaSetup(d);
  }

  async function enable2FA(e) {
    e.preventDefault();
    const r = await apiFetch('/api/auth/2fa/enable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: twoFaCode }) });
    const d = await r?.json();
    if (r?.ok) { setTwoFaEnabled(true); setTwoFaSetup(null); setTwoFaCode(''); setTwoFaMsg({ text: '2FA activado', ok: true }); }
    else setTwoFaMsg({ text: d?.error || 'Código incorrecto', ok: false });
    setTimeout(() => setTwoFaMsg({ text: '', ok: false }), 4000);
  }

  async function disable2FA(e) {
    e.preventDefault();
    const r = await apiFetch('/api/auth/2fa/disable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: disablePwd }) });
    const d = await r?.json();
    if (r?.ok) { setTwoFaEnabled(false); setShowDisable(false); setDisablePwd(''); setTwoFaMsg({ text: '2FA desactivado', ok: true }); }
    else setTwoFaMsg({ text: d?.error || 'Error', ok: false });
    setTimeout(() => setTwoFaMsg({ text: '', ok: false }), 4000);
  }

  // Pipeline stages handlers
  async function addStage() {
    if (!newStage.key.trim() || !newStage.label.trim()) return;
    const r = await apiFetch('/api/pipeline-stages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newStage) });
    const d = await r?.json();
    if (r?.ok) { setPipelineStages(prev => [...prev, d]); setNewStage({ key: '', label: '', color: '#6b7280' }); setStageMsg({ text: 'Etapa agregada', ok: true }); }
    else setStageMsg({ text: d?.error || 'Error', ok: false });
    setTimeout(() => setStageMsg({ text: '', ok: false }), 3000);
  }

  async function deleteStage(id) {
    const r = await apiFetch(`/api/pipeline-stages/${id}`, { method: 'DELETE' });
    if (r?.ok) { setPipelineStages(prev => prev.filter(s => s.id !== id)); }
    else { const d = await r?.json(); setStageMsg({ text: d?.error || 'Error al eliminar', ok: false }); setTimeout(() => setStageMsg({ text: '', ok: false }), 4000); }
  }

  async function moveStage(id, direction) {
    const idx = pipelineStages.findIndex(s => s.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= pipelineStages.length) return;
    const a = pipelineStages[idx];
    const b = pipelineStages[swapIdx];
    await apiFetch(`/api/pipeline-stages/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: b.sort_order }) });
    await apiFetch(`/api/pipeline-stages/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: a.sort_order }) });
    const updated = [...pipelineStages];
    updated[idx] = { ...a, sort_order: b.sort_order };
    updated[swapIdx] = { ...b, sort_order: a.sort_order };
    updated.sort((x, y) => x.sort_order - y.sort_order);
    setPipelineStages(updated);
  }

  // Assignment rules handlers
  async function addRule() {
    if (!newRule.agent_id) return;
    const r = await apiFetch('/api/settings/assignment-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newRule, category_id: newRule.category_id || null }) });
    const d = await r?.json();
    if (r?.ok) { setRules(prev => [...prev, d]); setNewRule({ name: '', category_id: '', agent_id: '' }); setRuleMsg('Regla agregada'); setTimeout(() => setRuleMsg(''), 3000); }
  }

  async function toggleRule(id, is_active) {
    await apiFetch(`/api/settings/assignment-rules/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !is_active }) });
    setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: is_active ? 0 : 1 } : r));
  }

  async function deleteRule(id) {
    if (!confirm('¿Eliminar regla?')) return;
    await apiFetch(`/api/settings/assignment-rules/${id}`, { method: 'DELETE' });
    setRules(prev => prev.filter(r => r.id !== id));
  }

  async function importPhonebook() {
    setPhonebookImporting(true); setPhonebookResult(null);
    const r = await apiFetch('/api/sync/phonebook');
    const d = await r?.json();
    setPhonebookResult(d); setPhonebookImporting(false);
    setTimeout(() => setPhonebookResult(null), 8000);
  }

  async function saveSmtp(e) {
    e.preventDefault(); setSmtpSaving(true);
    const r = await apiFetch('/api/settings/smtp', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(smtpForm) });
    setSmtpSaving(false);
    if (r?.ok) { setSmtpMsg({ text: 'Guardado', ok: true }); } else { const d = await r?.json(); setSmtpMsg({ text: d?.error || 'Error', ok: false }); }
    setTimeout(() => setSmtpMsg({ text: '', ok: false }), 3000);
  }

  async function testSmtp() {
    if (!smtpTestEmail.trim()) return;
    setSmtpMsg({ text: 'Enviando...', ok: true });
    const r = await apiFetch('/api/settings/smtp/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: smtpTestEmail }) });
    const d = await r?.json();
    setSmtpMsg(r?.ok ? { text: 'Email enviado ✓', ok: true } : { text: d?.error || 'Error', ok: false });
    setTimeout(() => setSmtpMsg({ text: '', ok: false }), 5000);
  }

  async function downloadBackup() {
    const r = await apiFetch('/api/settings/backup');
    if (!r?.ok) return;
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rinran-backup-${new Date().toISOString().slice(0,10)}.db`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function uploadRestore(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('¿Restaurar esta base de datos? Esto reemplazará TODOS los datos actuales.')) { e.target.value = ''; return; }
    setRestoring(true); setBackupMsg({ text: '', ok: false });
    const r = await fetch('/api/settings/restore', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('rinran_token') || ''}`, 'Content-Type': 'application/octet-stream' },
      body: file,
    });
    const d = await r.json().catch(() => ({}));
    setRestoring(false);
    setBackupMsg(r.ok ? { text: d.message || 'Restaurado ✓', ok: true } : { text: d.error || 'Error', ok: false });
    e.target.value = '';
  }

  async function addOutboundHook() {
    if (!newHook.name.trim() || !newHook.url.trim()) return;
    const r = await apiFetch('/api/settings/outbound-webhooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newHook) });
    const d = await r?.json();
    if (r?.ok) { setOutboundHooks(prev => [...prev, d]); setNewHook({ name: '', url: '', events: 'message.inbound', secret: '' }); }
    else setHookMsg(d?.error || 'Error'); setTimeout(() => setHookMsg(''), 3000);
  }

  async function toggleOutboundHook(id, is_active) {
    await apiFetch(`/api/settings/outbound-webhooks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !is_active }) });
    setOutboundHooks(prev => prev.map(h => h.id === id ? { ...h, is_active: is_active ? 0 : 1 } : h));
  }

  async function deleteOutboundHook(id) {
    if (!confirm('¿Eliminar webhook?')) return;
    await apiFetch(`/api/settings/outbound-webhooks/${id}`, { method: 'DELETE' });
    setOutboundHooks(prev => prev.filter(h => h.id !== id));
  }

  async function createApiKey() {
    if (!newKeyName.trim()) return;
    const r = await apiFetch('/api/settings/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newKeyName }) });
    const d = await r?.json();
    if (r?.ok) { setApiKeys(prev => [d, ...prev]); setNewKeyResult(d); setNewKeyName(''); }
    else { setKeyMsg(d?.error || 'Error'); setTimeout(() => setKeyMsg(''), 3000); }
  }

  async function deleteApiKey(id) {
    if (!confirm('¿Revocar esta API key?')) return;
    await apiFetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
    setApiKeys(prev => prev.filter(k => k.id !== id));
  }

  if (!settings) return <div className="flex items-center justify-center h-full text-gray-600"><div className="animate-pulse">Cargando...</div></div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <SettingsIcon size={20} className="text-gray-400" />
        <h1 className="text-xl font-bold text-white">Configuración</h1>
      </div>

      {/* 2FA */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <Shield size={14} /> Verificación en 2 pasos (2FA)
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold ${twoFaEnabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
            {twoFaEnabled ? 'Activo' : 'Inactivo'}
          </span>
        </h2>

        {twoFaMsg.text && <p className={`text-sm mb-3 ${twoFaMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{twoFaMsg.text}</p>}

        {!twoFaEnabled && !twoFaSetup && (
          <button onClick={setup2FA}
            className="flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-700 text-yellow-400 px-4 py-2 rounded-lg text-sm transition-colors">
            <ShieldCheck size={14} /> Activar 2FA
          </button>
        )}

        {!twoFaEnabled && twoFaSetup && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">Escanea este código QR con Google Authenticator, Authy u otra app TOTP:</p>
            {twoFaSetup.qr_data_url ? (
              <img src={twoFaSetup.qr_data_url} alt="QR 2FA" className="w-40 h-40 rounded-lg bg-white p-1" />
            ) : (
              <p className="text-xs text-gray-500 break-all font-mono bg-gray-800 p-2 rounded">{twoFaSetup.otpauth_url}</p>
            )}
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Clave secreta (ingresa manualmente si no puedes escanear):</p>
              <p className="font-mono text-sm text-white tracking-widest">{twoFaSetup.secret}</p>
            </div>
            <form onSubmit={enable2FA} className="flex gap-2">
              <input required value={twoFaCode} onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                maxLength={6} inputMode="numeric" placeholder="Código de 6 dígitos"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white text-center tracking-widest font-mono focus:outline-none focus:border-yellow-500" />
              <button type="submit" disabled={twoFaCode.length < 6}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black rounded-lg text-sm font-medium">Verificar</button>
            </form>
          </div>
        )}

        {twoFaEnabled && !showDisable && (
          <button onClick={() => setShowDisable(true)}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 px-4 py-2 rounded-lg text-sm transition-colors">
            <ShieldOff size={14} /> Desactivar 2FA
          </button>
        )}

        {twoFaEnabled && showDisable && (
          <form onSubmit={disable2FA} className="flex gap-2">
            <input required type="password" value={disablePwd} onChange={e => setDisablePwd(e.target.value)}
              placeholder="Confirma tu contraseña"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500" />
            <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium">Desactivar</button>
            <button type="button" onClick={() => setShowDisable(false)} className="px-3 py-2 text-gray-500 hover:text-white">✕</button>
          </form>
        )}
      </section>

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

      {/* Phonebook import (admin only) */}
      {isAdmin && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><BookOpen size={14} /> Importar agenda del teléfono</h2>
          <p className="text-xs text-gray-500 mb-3">Importa todos los contactos de WhatsApp directamente desde la agenda del dispositivo conectado a WAHA.</p>
          <div className="flex items-center gap-3">
            <button onClick={importPhonebook} disabled={phonebookImporting}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {phonebookImporting ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <BookOpen size={14} />}
              {phonebookImporting ? 'Importando...' : 'Importar agenda'}
            </button>
            {phonebookResult && (
              <span className={`text-sm ${phonebookResult.error ? 'text-red-400' : 'text-green-400'}`}>
                {phonebookResult.error || `${phonebookResult.imported} importados, ${phonebookResult.skipped} omitidos`}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Pipeline stages (admin only) */}
      {isAdmin && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <BookOpen size={14} /> Etapas del Pipeline
          </h2>
          <p className="text-xs text-gray-500 mb-4">Definí las columnas del Pipeline. Arrastrá contactos entre columnas en la vista Pipeline.</p>
          <div className="space-y-2 mb-4">
            {pipelineStages.map((s, idx) => (
              <div key={s.id} className="flex items-center gap-2 rounded-lg px-3 py-2.5 border border-gray-700 bg-gray-800">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white">{s.label}</span>
                  <span className="text-xs text-gray-600 ml-2 font-mono">{s.key}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveStage(s.id, 'up')} disabled={idx === 0}
                    className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-20 transition-colors">
                    <ChevronUp size={13} />
                  </button>
                  <button onClick={() => moveStage(s.id, 'down')} disabled={idx === pipelineStages.length - 1}
                    className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-20 transition-colors">
                    <ChevronDown size={13} />
                  </button>
                </div>
                <button onClick={() => deleteStage(s.id)} className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          {stageMsg.text && <p className={`text-sm mb-3 ${stageMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{stageMsg.text}</p>}
          <div className="grid grid-cols-12 gap-2">
            <input value={newStage.label} onChange={e => setNewStage(n => ({ ...n, label: e.target.value, key: e.target.value.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') }))}
              placeholder="Nombre (ej: Negociación)"
              className="col-span-5 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            <input value={newStage.key} onChange={e => setNewStage(n => ({ ...n, key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
              placeholder="Clave (ej: negociacion)"
              className="col-span-4 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-green-500" />
            <input type="color" value={newStage.color} onChange={e => setNewStage(n => ({ ...n, color: e.target.value }))}
              className="col-span-1 h-10 w-full rounded-lg border border-gray-700 bg-gray-800 cursor-pointer" />
            <button onClick={addStage} disabled={!newStage.key.trim() || !newStage.label.trim()}
              className="col-span-2 flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-sm transition-colors">
              <Plus size={14} /> Agregar
            </button>
          </div>
        </section>
      )}

      {/* Assignment rules (admin only) */}
      {isAdmin && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2"><Users2 size={14} /> Asignación automática</h2>
          <p className="text-xs text-gray-500 mb-4">Los nuevos contactos se asignan automáticamente al primer agente cuya regla coincida.</p>
          <div className="space-y-2 mb-4">
            {rules.length === 0 && <p className="text-xs text-gray-600">Sin reglas. Los nuevos contactos no se asignarán automáticamente.</p>}
            {rules.map(r => (
              <div key={r.id} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border ${r.is_active ? 'border-gray-700 bg-gray-800' : 'border-gray-800 bg-gray-900 opacity-60'}`}>
                <button onClick={() => toggleRule(r.id, r.is_active)} title={r.is_active ? 'Desactivar' : 'Activar'}>
                  {r.is_active
                    ? <ToggleRight size={20} className="text-green-400" />
                    : <ToggleLeft size={20} className="text-gray-600" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{r.name || 'Sin nombre'}</p>
                  <p className="text-xs text-gray-500">
                    {r.category_name ? `Categoría: ${r.category_name}` : 'Cualquier contacto nuevo'} → {r.agent_name}
                  </p>
                </div>
                <button onClick={() => deleteRule(r.id)} className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          {ruleMsg && <p className="text-sm text-green-400 mb-3">{ruleMsg}</p>}
          <div className="grid grid-cols-3 gap-2">
            <input value={newRule.name} onChange={e => setNewRule(n => ({ ...n, name: e.target.value }))}
              placeholder="Nombre de la regla"
              className="col-span-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            <select value={newRule.category_id} onChange={e => setNewRule(n => ({ ...n, category_id: e.target.value }))}
              className="col-span-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-green-500">
              <option value="">Cualquier categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select required value={newRule.agent_id} onChange={e => setNewRule(n => ({ ...n, agent_id: e.target.value }))}
              className="col-span-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-green-500">
              <option value="">Seleccionar agente *</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button onClick={addRule} disabled={!newRule.agent_id}
              className="flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-sm transition-colors">
              <Plus size={14} /> Agregar
            </button>
          </div>
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
              onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Nombre del tag..."
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
              onKeyDown={e => e.key === 'Enter' && addCustomField()} placeholder="Nombre del campo..."
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

      {/* SMTP (admin only) */}
      {isAdmin && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2"><Mail size={14} /> Correo electrónico (SMTP)</h2>
          <form onSubmit={saveSmtp} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Servidor SMTP</label>
                <input value={smtpForm.smtp_host} onChange={e => setSmtpForm(f => ({ ...f, smtp_host: e.target.value }))}
                  placeholder="smtp.gmail.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Puerto</label>
                <input type="number" value={smtpForm.smtp_port} onChange={e => setSmtpForm(f => ({ ...f, smtp_port: e.target.value }))}
                  placeholder="587"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Usuario</label>
              <input value={smtpForm.smtp_user} onChange={e => setSmtpForm(f => ({ ...f, smtp_user: e.target.value }))}
                placeholder="usuario@gmail.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Contraseña</label>
              <div className="relative">
                <input type={smtpShowPass ? 'text' : 'password'} value={smtpForm.smtp_pass} onChange={e => setSmtpForm(f => ({ ...f, smtp_pass: e.target.value }))}
                  placeholder="Contraseña o app password"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-green-500" />
                <button type="button" onClick={() => setSmtpShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  {smtpShowPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Remitente (from)</label>
              <input value={smtpForm.smtp_from} onChange={e => setSmtpForm(f => ({ ...f, smtp_from: e.target.value }))}
                placeholder="Rinran CRM <noreply@empresa.com>"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button type="submit" disabled={smtpSaving}
                className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                <Save size={14} /> {smtpSaving ? 'Guardando...' : 'Guardar SMTP'}
              </button>
              {smtpMsg.text && <span className={`text-sm ${smtpMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{smtpMsg.text}</span>}
            </div>
          </form>
          <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-2">
            <input value={smtpTestEmail} onChange={e => setSmtpTestEmail(e.target.value)}
              placeholder="Email de prueba"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            <button onClick={testSmtp} disabled={!smtpTestEmail.trim()}
              className="flex items-center gap-1.5 border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm disabled:opacity-40">
              <Mail size={14} /> Enviar prueba
            </button>
          </div>
        </section>
      )}

      {/* Backup / Restore (admin only) */}
      {isAdmin && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Database size={14} /> Respaldo y restauración</h2>
          <p className="text-xs text-gray-500 mb-4">Descarga una copia de la base de datos SQLite o restaura desde un respaldo anterior.</p>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={downloadBackup}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Download size={14} /> Descargar respaldo
            </button>
            <label className={`flex items-center gap-1.5 border border-gray-600 hover:border-orange-500 text-gray-300 hover:text-orange-400 px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors ${restoring ? 'opacity-50 pointer-events-none' : ''}`}>
              {restoring ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
              {restoring ? 'Restaurando...' : 'Restaurar respaldo'}
              <input type="file" accept=".db" className="hidden" onChange={uploadRestore} />
            </label>
          </div>
          {backupMsg.text && <p className={`text-sm mt-3 ${backupMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{backupMsg.text}</p>}
        </section>
      )}

      {/* Outbound Webhooks (admin only) */}
      {isAdmin && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2"><Link size={14} /> Webhooks salientes</h2>
          <p className="text-xs text-gray-500 mb-4">Recibe notificaciones en tus servicios cuando lleguen mensajes nuevos.</p>
          <div className="space-y-2 mb-4">
            {outboundHooks.length === 0 && <p className="text-xs text-gray-600">Sin webhooks configurados</p>}
            {outboundHooks.map(h => (
              <div key={h.id} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border ${h.is_active ? 'border-gray-700 bg-gray-800' : 'border-gray-800 bg-gray-900 opacity-60'}`}>
                <button onClick={() => toggleOutboundHook(h.id, h.is_active)}>
                  {h.is_active ? <ToggleRight size={20} className="text-green-400" /> : <ToggleLeft size={20} className="text-gray-600" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{h.name}</p>
                  <p className="text-xs text-gray-500 truncate">{h.url}</p>
                </div>
                <span className="text-[10px] text-gray-600 shrink-0">{h.events}</span>
                <button onClick={() => deleteOutboundHook(h.id)} className="p-1 text-gray-600 hover:text-red-400 shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          {hookMsg && <p className="text-sm text-red-400 mb-2">{hookMsg}</p>}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input value={newHook.name} onChange={e => setNewHook(h => ({ ...h, name: e.target.value }))}
                placeholder="Nombre *"
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
              <select value={newHook.events} onChange={e => setNewHook(h => ({ ...h, events: e.target.value }))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-green-500">
                <option value="message.inbound">Mensajes entrantes</option>
                <option value="message.inbound,message.outbound">Todos los mensajes</option>
                <option value="contact.new">Contacto nuevo</option>
              </select>
            </div>
            <input value={newHook.url} onChange={e => setNewHook(h => ({ ...h, url: e.target.value }))}
              placeholder="URL del endpoint (https://...) *"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            <div className="flex gap-2">
              <input value={newHook.secret} onChange={e => setNewHook(h => ({ ...h, secret: e.target.value }))}
                placeholder="Secret para firma HMAC (opcional)"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
              <button onClick={addOutboundHook} disabled={!newHook.name.trim() || !newHook.url.trim()}
                className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                <Plus size={14} /> Agregar
              </button>
            </div>
          </div>
        </section>
      )}

      {/* API Keys (admin only) */}
      {isAdmin && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2"><Key size={14} /> API Keys externas</h2>
          <p className="text-xs text-gray-500 mb-4">Genera claves para acceder a la API de Rinran CRM desde servicios externos.</p>
          {newKeyResult && (
            <div className="mb-4 p-3 bg-green-900/20 border border-green-700 rounded-xl">
              <p className="text-xs text-green-400 mb-1 font-medium">¡Clave generada! Cópiala ahora, no se mostrará de nuevo.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-green-300 bg-gray-900 px-3 py-2 rounded-lg break-all">{newKeyResult.key}</code>
                <button onClick={() => { navigator.clipboard.writeText(newKeyResult.key); }} className="p-2 text-green-400 hover:text-white shrink-0" title="Copiar">
                  <Copy size={14} />
                </button>
              </div>
              <button onClick={() => setNewKeyResult(null)} className="mt-2 text-xs text-gray-500 hover:text-white">Cerrar</button>
            </div>
          )}
          <div className="space-y-2 mb-4">
            {apiKeys.length === 0 && <p className="text-xs text-gray-600">Sin API keys</p>}
            {apiKeys.map(k => (
              <div key={k.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{k.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{k.key_prefix}… · {k.last_used_at ? `último uso: ${new Date(k.last_used_at.replace(' ','T')+'Z').toLocaleDateString('es')}` : 'nunca usado'}</p>
                </div>
                <button onClick={() => deleteApiKey(k.id)} className="p-1 text-gray-600 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          {keyMsg && <p className="text-sm text-red-400 mb-2">{keyMsg}</p>}
          <div className="flex gap-2">
            <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createApiKey()}
              placeholder="Nombre de la clave..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            <button onClick={createApiKey} disabled={!newKeyName.trim()}
              className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-sm transition-colors">
              <Plus size={14} /> Generar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
