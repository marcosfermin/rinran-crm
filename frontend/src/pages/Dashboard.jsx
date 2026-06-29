import { useEffect, useState } from 'react';
import { Users, MessageSquare, TrendingUp, Bell } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value ?? '—'}</p>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    apiFetch('/api/stats').then(r => r?.json()).then(d => d && setStats(d)).catch(() => {});
  }, []);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-white">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users} label="Contactos activos" value={stats?.totalContacts}
          sub={`+${stats?.newToday ?? 0} hoy`} color="bg-blue-500/10 text-blue-400" />
        <StatCard icon={MessageSquare} label="Mensajes enviados" value={stats?.totalMessages}
          color="bg-green-500/10 text-green-400" />
        <StatCard icon={Bell} label="Recibidos hoy" value={stats?.inboundToday}
          color="bg-purple-500/10 text-purple-400" />
        <StatCard icon={TrendingUp} label="Países" value={stats?.byCountry?.length}
          color="bg-orange-500/10 text-orange-400" />
      </div>

      <div className="space-y-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Por país</h2>
          <div className="space-y-2.5">
            {stats?.byCountry?.map(c => (
              <div key={c.country_code} className="flex items-center gap-2.5">
                <span className="text-xl shrink-0">{c.country_flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300 truncate">{c.country_name || 'Desconocido'}</span>
                    <span className="text-gray-500 shrink-0 ml-2">{c.n}</span>
                  </div>
                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full"
                      style={{ width: `${Math.round((c.n / (stats?.totalContacts || 1)) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
            {!stats?.byCountry?.length && <p className="text-gray-600 text-sm">Sin datos aún</p>}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Por categoría</h2>
          <div className="space-y-2.5">
            {stats?.byCategory?.map(c => (
              <div key={c.name} className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">{c.name}</span>
                    <span className="text-gray-500">{c.n}</span>
                  </div>
                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.round((c.n / (stats?.totalContacts || 1)) * 100)}%`, backgroundColor: c.color }} />
                  </div>
                </div>
              </div>
            ))}
            {!stats?.byCategory?.length && <p className="text-gray-600 text-sm">Sin datos aún</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
