import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, Users, Send, Tag, MessageSquare, Inbox, LogOut, GitBranch, Zap, Users2, Wifi, Menu, X } from 'lucide-react';
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

// Play a soft notification beep via Web Audio API
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

function sendBrowserNotification(title, body) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') {
    const n = new Notification(title, { body, icon: '/favicon.ico', silent: true });
    setTimeout(() => n.close(), 6000);
  }
}

const BOTTOM_NAV = [
  { to: '/inbox',    icon: Inbox,         label: 'Bandeja', end: false },
  { to: '/contacts', icon: Users,         label: 'Contactos', end: false },
  { to: '/pipeline', icon: GitBranch,     label: 'Pipeline', end: false },
  { to: '/broadcast',icon: Send,          label: 'Mensajes', end: false },
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard', end: true },
];

const SIDEBAR_NAV = [
  { to: '/inbox',     icon: Inbox,          label: 'Bandeja',    end: false },
  { to: '/contacts',  icon: Users,          label: 'Contactos',  end: false },
  { to: '/pipeline',  icon: GitBranch,      label: 'Pipeline',   end: false },
  { to: '/broadcast', icon: Send,           label: 'Mensajes',   end: false },
  { to: '/',          icon: LayoutDashboard,label: 'Dashboard',  end: true },
  { to: '/categories',icon: Tag,            label: 'Categorías', end: false },
  { to: '/templates', icon: Zap,            label: 'Plantillas', end: false },
  { to: '/team',      icon: Users2,         label: 'Equipo',     end: false },
  { to: '/sessions',  icon: Wifi,           label: 'Sesiones',   end: false },
];

function useUnreadCount(active) {
  const [count, setCount] = useState(0);
  const prevCount = useRef(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (!active) return;

    // Request browser notification permission on first load
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const check = () =>
      apiFetch('/api/inbox')
        .then(r => r?.json())
        .then(data => {
          if (!data) return;
          const newCount = data.reduce((s, c) => s + (c.unread_count || 0), 0);

          if (initialized.current && newCount > prevCount.current) {
            playNotificationSound();
            if (document.hidden) {
              sendBrowserNotification('Nuevo mensaje — Rinran CRM', `${newCount} mensaje${newCount > 1 ? 's' : ''} sin leer`);
            }
          }

          prevCount.current = newCount;
          initialized.current = true;
          setCount(newCount);
        })
        .catch(() => {});

    check();
    const t = setInterval(check, 8000);
    return () => clearInterval(t);
  }, [active]);

  // Update document title with unread badge
  useEffect(() => {
    document.title = count > 0 ? `(${count}) Rinran CRM` : 'Rinran CRM';
  }, [count]);

  return count;
}

function Sidebar({ unread, onLogout, user }) {
  return (
    <aside className="hidden md:flex w-56 bg-gray-900 border-r border-gray-800 flex-col shrink-0">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-green-400" size={20} />
          <span className="text-base font-bold text-white">Rinran <span className="text-green-400">CRM</span></span>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {SIDEBAR_NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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
          <div className="px-3 py-1.5 text-xs text-gray-500 truncate">{user.email}</div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut size={17} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function BottomNav({ unread }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-40">
      {BOTTOM_NAV.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
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

export default function App() {
  const { token, user, logout, checking } = useAuth();
  const unread = useUnreadCount(!!token);
  const location = useLocation();
  const isChat = location.pathname.startsWith('/contacts/');

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
      <Sidebar unread={unread} onLogout={logout} user={user} />
      <main className={`flex-1 overflow-y-auto scrollbar-thin ${isChat ? '' : 'pb-16 md:pb-0'}`}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/contacts/:id" element={<ContactDetail />} />
          <Route path="/broadcast" element={<Broadcast />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/team" element={<Team />} />
          <Route path="/sessions" element={<Sessions />} />
        </Routes>
      </main>
      <BottomNav unread={unread} />
    </div>
  );
}
