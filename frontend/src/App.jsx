import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Send, Tag, MessageSquare, Inbox, LogOut } from 'lucide-react';
import { useAuth } from './contexts/AuthContext.jsx';
import { apiFetch } from './utils/apiFetch.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import InboxPage from './pages/Inbox.jsx';
import Contacts from './pages/Contacts.jsx';
import ContactDetail from './pages/ContactDetail.jsx';
import Broadcast from './pages/Broadcast.jsx';
import Categories from './pages/Categories.jsx';

const nav = [
  { to: '/inbox', icon: Inbox, label: 'Bandeja' },
  { to: '/contacts', icon: Users, label: 'Contactos' },
  { to: '/broadcast', icon: Send, label: 'Mensajes' },
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/categories', icon: Tag, label: 'Categorías' },
];

function useUnreadCount(active) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    const check = () =>
      apiFetch('/api/inbox')
        .then(r => r?.json())
        .then(data => data && setCount(data.reduce((s, c) => s + (c.unread_count || 0), 0)))
        .catch(() => {});
    check();
    const t = setInterval(check, 8000);
    return () => clearInterval(t);
  }, [active]);
  return count;
}

function Sidebar({ unread, onLogout, user }) {
  return (
    <aside className="hidden md:flex w-60 bg-gray-900 border-r border-gray-800 flex-col shrink-0">
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-green-400" size={22} />
          <span className="text-lg font-bold text-white">Rinran <span className="text-green-400">CRM</span></span>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                isActive ? 'bg-green-500/10 text-green-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
            {label === 'Bandeja' && unread > 0 && (
              <span className="ml-auto bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-800 space-y-1">
        {user && (
          <div className="px-3 py-1.5 text-xs text-gray-500 truncate">{user.email}</div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function BottomNav({ unread }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-40">
      {nav.map(({ to, icon: Icon, label, end }) => (
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-600 text-sm animate-pulse">Cargando...</div>
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
        </Routes>
      </main>
      <BottomNav unread={unread} />
    </div>
  );
}
