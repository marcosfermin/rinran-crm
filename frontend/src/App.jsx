import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, Users, Send, Tag, MessageSquare, Inbox, LogOut, GitBranch, Zap, Users2, Wifi, Search, Bot, Settings, Bell, Trash2, Activity, Sun, Moon, Pencil, X } from 'lucide-react';
import { useAuth } from './contexts/AuthContext.jsx';
import { apiFetch } from './utils/apiFetch.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import InboxPage from './pages/Inbox.jsx';
import Contacts from './pages/Contacts.jsx';
import ContactDetail from './pages/ContactDetail.jsx';
import Broadcast from './pages/Broadcast.jsx';
import Categories from './pages/Categories.jsx';
import Pipeline from './pages/Pipeline.jsx';
import Templates from './pages/Templates.jsx';
import Team from './pages/Team.jsx';
import Sessions from './pages/Sessions.jsx';
import AutoReply from './pages/AutoReply.jsx';
import GlobalSearch from './pages/GlobalSearch.jsx';
import SettingsPage from './pages/Settings.jsx';
import Reminders from './pages/Reminders.jsx';
import Trash from './pages/Trash.jsx';
import WebhookLog from './pages/WebhookLog.jsx';

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

function sendBrowserNotification(title, body) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') {
    const n = new Notification(title, { body, icon: '/favicon.ico', silent: true });
    setTimeout(() => n.close(), 6000);
  }
}

// --- Theme ---
function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);
  return [theme, () => setTheme(t => t === 'dark' ? 'light' : 'dark')];
}

// --- SSE + unread count ---
function useRealtimeUnread(token, onNewMessage, onReminder) {
  const [count, setCount] = useState(0);
  const prevCount = useRef(0);
  const initialized = useRef(false);
  const esRef = useRef(null);

  // Initial fetch + fallback polling (every 30s instead of 8s)
  useEffect(() => {
    if (!token) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const fetchCount = () =>
      apiFetch('/api/inbox').then(r => r?.json()).then(data => {
        if (!data) return;
        const newCount = (data.conversations ?? data).reduce((s, c) => s + (c.unread_count || 0), 0);
        if (initialized.current && newCount > prevCount.current) {
          playNotificationSound();
          if (document.hidden) sendBrowserNotification('Nuevo mensaje — Rinran CRM', `${newCount} mensaje${newCount > 1 ? 's' : ''} sin leer`);
          onNewMessage?.();
        }
        prevCount.current = newCount;
        initialized.current = true;
        setCount(newCount);
      }).catch(() => {});

    fetchCount();
    const t = setInterval(fetchCount, 30000);
    return () => clearInterval(t);
  }, [token]);

  // SSE connection
  useEffect(() => {
    if (!token) return;

    const connect = () => {
      const es = new EventSource(`/api/sse?token=${encodeURIComponent(token)}`);
      esRef.current = es;

      es.addEventListener('message', () => {
        // New inbound message → refresh count immediately
        apiFetch('/api/inbox').then(r => r?.json()).then(data => {
          if (!data) return;
          const newCount = (data.conversations ?? data).reduce((s, c) => s + (c.unread_count || 0), 0);
          if (newCount > prevCount.current) {
            playNotificationSound();
            if (document.hidden) sendBrowserNotification('Nuevo mensaje — Rinran CRM', `${newCount} sin leer`);
            onNewMessage?.();
          }
          prevCount.current = newCount;
          setCount(newCount);
        }).catch(() => {});
      });

      es.addEventListener('reminder', e => {
        try {
          const data = JSON.parse(e.data);
          onReminder?.(data);
          sendBrowserNotification('Recordatorio', `${data.title} — ${data.contact_name}`);
          playNotificationSound();
        } catch {}
      });

      es.onerror = () => {
        es.close();
        setTimeout(connect, 5000);
      };
    };

    connect();
    return () => { esRef.current?.close(); };
  }, [token]);

  useEffect(() => {
    document.title = count > 0 ? `(${count}) Rinran CRM` : 'Rinran CRM';
  }, [count]);

  return count;
}

// --- Quick Compose Modal ---
function QuickCompose({ onClose }) {
  const [form, setForm] = useState({ phone: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function send(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    const r = await apiFetch('/api/messages/quick-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: form.phone, message: form.message }),
    });
    setLoading(false);
    if (r?.ok) { setSuccess(true); setTimeout(onClose, 1200); }
    else { const d = await r?.json(); setError(d?.error || 'Error al enviar'); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 px-4 pb-20 md:pb-0" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Pencil size={14} /> Mensaje rápido</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        {success ? (
          <div className="text-center py-4 text-green-400 font-medium">Enviado ✓</div>
        ) : (
          <form onSubmit={send} className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Teléfono</label>
              <input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+52 55 1234 5678"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Mensaje</label>
              <textarea required value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={3} placeholder="Escribe tu mensaje..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 resize-none" />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-2 rounded-xl border border-gray-700 text-sm text-gray-300 hover:bg-gray-800">Cancelar</button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white text-sm font-medium">
                {loading ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// --- Reminder toast ---
function ReminderToast({ reminder, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 8000); return () => clearTimeout(t); }, []);
  return (
    <div className="fixed bottom-24 md:bottom-6 right-4 z-50 bg-yellow-900 border border-yellow-700 rounded-xl px-4 py-3 shadow-xl max-w-xs flex items-start gap-3 animate-slide-up">
      <Bell size={16} className="text-yellow-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">Recordatorio</p>
        <p className="text-xs text-yellow-200 truncate">{reminder.title}</p>
        <p className="text-xs text-yellow-400/70">{reminder.contact_name}</p>
      </div>
      <button onClick={onClose} className="text-yellow-600 hover:text-white"><X size={13} /></button>
    </div>
  );
}

const BOTTOM_NAV = [
  { to: '/inbox',    icon: Inbox,          label: 'Bandeja', end: false },
  { to: '/contacts', icon: Users,          label: 'Contactos', end: false },
  { to: '/pipeline', icon: GitBranch,      label: 'Pipeline', end: false },
  { to: '/broadcast',icon: Send,           label: 'Mensajes', end: false },
  { to: '/',         icon: LayoutDashboard,label: 'Dashboard', end: true },
];

function buildSidebarNav(role) {
  const nav = [
    { to: '/inbox',       icon: Inbox,          label: 'Bandeja',    end: false },
    { to: '/contacts',    icon: Users,           label: 'Contactos',  end: false },
    { to: '/pipeline',    icon: GitBranch,       label: 'Pipeline',   end: false },
    { to: '/broadcast',   icon: Send,            label: 'Mensajes',   end: false },
    { to: '/',            icon: LayoutDashboard, label: 'Dashboard',  end: true },
    { to: '/search',      icon: Search,          label: 'Buscar',     end: false },
    { to: '/reminders',   icon: Bell,            label: 'Recordatorios', end: false },
    { to: '/trash',       icon: Trash2,          label: 'Papelera',   end: false },
  ];
  if (role === 'admin') {
    nav.push(
      { to: '/categories', icon: Tag,      label: 'Categorías', end: false },
      { to: '/templates',  icon: Zap,      label: 'Plantillas', end: false },
      { to: '/auto-reply', icon: Bot,      label: 'AutoReply',  end: false },
      { to: '/team',       icon: Users2,   label: 'Equipo',     end: false },
      { to: '/sessions',   icon: Wifi,     label: 'Sesiones',   end: false },
      { to: '/webhook-log',icon: Activity, label: 'Webhook Log',end: false },
      { to: '/settings',   icon: Settings, label: 'Config',     end: false },
    );
  }
  return nav;
}

function Sidebar({ unread, onLogout, user, onQuickCompose, theme, onToggleTheme }) {
  const nav = buildSidebarNav(user?.role);
  return (
    <aside className="hidden md:flex w-56 bg-gray-900 border-r border-gray-800 flex-col shrink-0">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-green-400" size={20} />
          <span className="text-base font-bold text-white">Rinran <span className="text-green-400">CRM</span></span>
        </div>
        <button onClick={onToggleTheme} title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
          className="text-gray-500 hover:text-white transition-colors">
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
      <div className="px-2 pt-2">
        <button onClick={onQuickCompose}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-800 text-green-400 hover:bg-green-500/20 text-xs font-medium transition-colors">
          <Pencil size={13} /> Mensaje rápido
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto mt-1">
        {nav.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                isActive ? 'bg-green-500/10 text-green-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={17} />
            {label}
            {label === 'Bandeja' && unread > 0 && (
              <span className="ml-auto bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="p-2 border-t border-gray-800 space-y-0.5">
        {user && (
          <div className="px-3 py-1.5 text-xs text-gray-500 truncate">
            {user.email}
            {user.role === 'agent' && <span className="ml-1 text-blue-400">(agente)</span>}
          </div>
        )}
        <button onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
          <LogOut size={17} /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function BottomNav({ unread }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-40">
      {BOTTOM_NAV.map(({ to, icon: Icon, label, end }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors relative ${
              isActive ? 'text-green-400' : 'text-gray-500'
            }`
          }
        >
          <div className="relative">
            <Icon size={20} />
            {label === 'Bandeja' && unread > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-green-500 text-white text-[10px] font-bold px-1 rounded-full min-w-[16px] text-center leading-4">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

// --- Push subscription ---
async function subscribeToPush(token) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const r = await apiFetch('/api/push/vapid-key');
    const { publicKey } = await r.json();
    if (!publicKey) return;
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      // Re-register existing subscription in case it's a new session
      const { endpoint, keys } = existing.toJSON();
      await apiFetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint, keys }),
      });
      return;
    }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const { endpoint, keys } = sub.toJSON();
    await apiFetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, keys }),
    });
  } catch {}
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

// --- PWA install prompt ---
function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  useEffect(() => {
    const handler = e => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  const install = async () => { if (!prompt) return; prompt.prompt(); const { outcome } = await prompt.userChoice; if (outcome === 'accepted') setPrompt(null); };
  return [prompt, install];
}

function InstallBanner({ onInstall, onDismiss }) {
  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-72 bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 shadow-xl z-50 flex items-center gap-3 animate-slide-up">
      <MessageSquare size={18} className="text-green-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white">Instalar Rinran CRM</p>
        <p className="text-[10px] text-gray-400">Acceso rápido desde tu pantalla de inicio</p>
      </div>
      <button onClick={onInstall} className="text-xs px-2.5 py-1 bg-green-500 hover:bg-green-400 text-white rounded-lg font-medium">Instalar</button>
      <button onClick={onDismiss} className="text-gray-600 hover:text-white"><X size={13} /></button>
    </div>
  );
}

export default function App() {
  const { token, user, logout, checking } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const [showCompose, setShowCompose] = useState(false);
  const [activeReminder, setActiveReminder] = useState(null);
  const [installPrompt, triggerInstall] = useInstallPrompt();
  const [dismissedInstall, setDismissedInstall] = useState(() => sessionStorage.getItem('install_dismissed') === '1');
  const location = useLocation();
  const isChat = location.pathname.startsWith('/contacts/') || /^\/inbox\/\d+/.test(location.pathname);

  // Subscribe to push when logged in (request permission if needed)
  useEffect(() => {
    if (!token) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      subscribeToPush(token);
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => { if (p === 'granted') subscribeToPush(token); }).catch(() => {});
    }
  }, [token]);

  const unread = useRealtimeUnread(
    token,
    () => {},
    data => setActiveReminder(data)
  );

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-gray-400 text-sm">Cargando...</div>
      </div>
    );
  }

  if (!token) return <Login />;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar unread={unread} onLogout={logout} user={user}
        onQuickCompose={() => setShowCompose(true)}
        theme={theme} onToggleTheme={toggleTheme} />
      <main className={`flex-1 ${isChat ? 'overflow-hidden' : 'overflow-y-auto pb-16 md:pb-0'} scrollbar-thin`}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/inbox/:selectedId" element={<InboxPage />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/contacts/:id" element={<ContactDetail />} />
          <Route path="/broadcast" element={<Broadcast />} />
          <Route path="/categories" element={user?.role === 'admin' ? <Categories /> : <Navigate to="/inbox" replace />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/team" element={user?.role === 'admin' ? <Team /> : <Navigate to="/inbox" replace />} />
          <Route path="/sessions" element={user?.role === 'admin' ? <Sessions /> : <Navigate to="/inbox" replace />} />
          <Route path="/auto-reply" element={<AutoReply />} />
          <Route path="/search" element={<GlobalSearch />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/trash" element={<Trash />} />
          <Route path="/webhook-log" element={user?.role === 'admin' ? <WebhookLog /> : <Navigate to="/inbox" replace />} />
        </Routes>
      </main>
      <BottomNav unread={unread} />
      {showCompose && <QuickCompose onClose={() => setShowCompose(false)} />}
      {activeReminder && <ReminderToast reminder={activeReminder} onClose={() => setActiveReminder(null)} />}
      {installPrompt && !dismissedInstall && (
        <InstallBanner
          onInstall={() => { triggerInstall(); setDismissedInstall(true); }}
          onDismiss={() => { setDismissedInstall(true); sessionStorage.setItem('install_dismissed', '1'); }}
        />
      )}
    </div>
  );
}
