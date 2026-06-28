import { useEffect, useState } from 'react';
import { Users, MessageSquare, TrendingUp, Bell } from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value ?? '—'}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Contactos activos" value={stats?.totalContacts} sub={`+${stats?.newToday ?? 0} hoy`} color="bg-blue-500/10 text-blue-400" />
        <StatCard icon={MessageSquare} label="Mensajes enviados" value={stats?.totalMessages} color="bg-green-500/10 text-green-400" />
        <StatCard icon={Bell} label="Mensajes recibidos hoy" value={stats?.inboundToday} color="bg-purple-500/10 text-purple-400" />
        <StatCard icon={TrendingUp} label="Países" value={stats?.byCountry?.length} color="bg-orange-500/10 text-orange-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* By Country */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Contactos por país</h2>
          <div className="space-y-2">
            {stats?.byCountry?.map(c => (
              <div key={c.country_code} className="flex items-center gap-3">
                <span className="text-2xl">{c.country_flag}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{c.country_name || 'Desconocido'}</span>
                    <span className="text-gray-400">{c.n}</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${Math.round((c.n / (stats?.totalContacts || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {!stats?.byCountry?.length && <p className="text-gray-600 text-sm">Sin datos aún</p>}
          </div>
        </div>

        {/* By Category */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Contactos por categoría</h2>
          <div className="space-y-3">
            {stats?.byCategory?.map(c => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{c.name}</span>
                    <span className="text-gray-400">{c.n}</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round((c.n / (stats?.totalContacts || 1)) * 100)}%`, backgroundColor: c.color }}
                    />
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
