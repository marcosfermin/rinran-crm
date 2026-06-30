import { useEffect, useState } from 'react';
import { Users, MessageSquare, TrendingUp, Bell, Clock, Inbox, GitBranch, Download, UserCheck } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch.js';

const STAGE_COLORS = {
  nuevo: '#6b7280', contactado: '#3b82f6', en_progreso: '#f59e0b',
  propuesta: '#8b5cf6', ganado: '#10b981', perdido: '#ef4444',
};
const STAGE_LABELS = {
  nuevo: 'Nuevo', contactado: 'Contactado', en_progreso: 'En progreso',
  propuesta: 'Propuesta', ganado: 'Ganado', perdido: 'Perdido',
};
const CONV_COLORS = { open: '#10b981', pending: '#f59e0b', closed: '#6b7280' };
const CONV_LABELS = { open: 'Abierto', pending: 'Pendiente', closed: 'Cerrado' };

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value ?? '—'}</p>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg ${color}`}><Icon size={18} /></div>
      </div>
    </div>
  );
}

function BarChart({ data }) {
  if (!data?.length) return <p className="text-gray-600 text-sm">Sin datos aún</p>;
  const maxVal = Math.max(...data.map(d => Math.max(d.inbound, d.outbound)), 1);
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    const day = d.toISOString().slice(0, 10);
    const found = data.find(r => r.day === day);
    return { day, inbound: found?.inbound || 0, outbound: found?.outbound || 0, label: d.getDate() };
  });

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-0.5 h-24">
        {last14.map(d => (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-0 h-full justify-end relative group">
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-xs text-white px-2 py-1 rounded pointer-events-none opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
              {d.day}<br />↓{d.inbound} ↑{d.outbound}
            </div>
            <div className="w-full flex flex-col justify-end gap-px">
              <div className="w-full bg-green-500/70 rounded-t-sm"
                style={{ height: `${(d.outbound / maxVal) * 88}px` }} />
              <div className="w-full bg-blue-400/70 rounded-t-sm"
                style={{ height: `${(d.inbound / maxVal) * 88}px` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500/70" /> Enviados</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400/70" /> Recibidos</span>
        <span className="ml-auto">Últimos 14 días</span>
      </div>
    </div>
  );
}

function HorizontalBar({ items, colorMap, labelMap, total }) {
  if (!items?.length) return <p className="text-gray-600 text-sm">Sin datos aún</p>;
  return (
    <div className="space-y-2.5">
      {items.map(item => {
        const key = item.pipeline_stage || item.conv_status;
        const color = colorMap?.[key] || '#6b7280';
        const label = labelMap?.[key] || key || 'Desconocido';
        const pct = Math.round((item.n / (total || 1)) * 100);
        return (
          <div key={key} className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-300 truncate">{label}</span>
                <span className="text-gray-500 ml-2 shrink-0">{item.n} ({pct}%)</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/stats').then(r => r?.json()).then(d => { d && setStats(d); setLoading(false); }).catch(() => setLoading(false));
    const t = setInterval(() => apiFetch('/api/stats').then(r => r?.json()).then(d => d && setStats(d)).catch(() => {}), 30000);
    return () => clearInterval(t);
  }, []);

  async function exportCSV() {
    const r = await apiFetch('/api/stats/export');
    if (!r?.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'contactos.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return (
    <div className="p-4 flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const totalActive = stats?.totalContacts || 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
          <Download size={13} /> Exportar CSV
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard icon={Users} label="Contactos activos" value={stats?.totalContacts}
          sub={`+${stats?.newToday ?? 0} hoy`} color="bg-blue-500/10 text-blue-400" />
        <StatCard icon={MessageSquare} label="Mensajes enviados" value={stats?.totalMessages}
          color="bg-green-500/10 text-green-400" />
        <StatCard icon={Bell} label="Recibidos hoy" value={stats?.inboundToday}
          color="bg-purple-500/10 text-purple-400" />
        <StatCard icon={Inbox} label="Chats abiertos" value={stats?.openConvs}
          color="bg-emerald-500/10 text-emerald-400" />
        <StatCard icon={Clock} label="Tiempo resp." value={stats?.avgResponseMinutes ? `${stats.avgResponseMinutes}m` : '—'}
          sub="Promedio" color="bg-orange-500/10 text-orange-400" />
        <StatCard icon={TrendingUp} label="Países" value={stats?.byCountry?.length}
          color="bg-pink-500/10 text-pink-400" />
      </div>

      {/* Messages chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Mensajes por día</h2>
        <BarChart data={stats?.msgPerDay} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pipeline funnel */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <GitBranch size={12} /> Pipeline
          </h2>
          <HorizontalBar items={stats?.pipelineFunnel} colorMap={STAGE_COLORS} labelMap={STAGE_LABELS} total={totalActive} />
        </div>

        {/* Conv status */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Inbox size={12} /> Estado conversaciones
          </h2>
          <HorizontalBar items={stats?.convStatusBreakdown} colorMap={CONV_COLORS} labelMap={CONV_LABELS} total={totalActive} />
        </div>

        {/* By country */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Por país</h2>
          <div className="space-y-2.5">
            {stats?.byCountry?.map(c => (
              <div key={c.country_name} className="flex items-center gap-2.5">
                <span className="text-xl shrink-0">{c.country_flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300 truncate">{c.country_name || 'Desconocido'}</span>
                    <span className="text-gray-500 shrink-0 ml-2">{c.n}</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.round((c.n / totalActive) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
            {!stats?.byCountry?.length && <p className="text-gray-600 text-sm">Sin datos aún</p>}
          </div>
        </div>

        {/* By category */}
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
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.round((c.n / totalActive) * 100)}%`, backgroundColor: c.color }} />
                  </div>
                </div>
              </div>
            ))}
            {!stats?.byCategory?.length && <p className="text-gray-600 text-sm">Sin datos aún</p>}
          </div>
        </div>
      </div>

      {/* Agent metrics */}
      {stats?.agentMetrics?.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <UserCheck size={12} /> Rendimiento por agente
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 font-medium">Agente</th>
                  <th className="text-right py-2 font-medium">Conversaciones</th>
                  <th className="text-right py-2 font-medium">Abiertas</th>
                  <th className="text-right py-2 font-medium">T. Resp. promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {stats.agentMetrics.map(a => (
                  <tr key={a.id} className="text-xs">
                    <td className="py-2.5 text-gray-300">{a.name}</td>
                    <td className="py-2.5 text-right text-white font-medium">{a.conversations}</td>
                    <td className="py-2.5 text-right text-yellow-400">{a.open_convs}</td>
                    <td className="py-2.5 text-right text-gray-400">
                      {a.avg_response_minutes ? `${Math.round(a.avg_response_minutes)}m` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats?.overdueReminders > 0 && (
        <div className="bg-red-950/20 border border-red-800/50 rounded-xl p-4 flex items-center gap-3">
          <Bell size={16} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300">
            Tienes <span className="font-bold">{stats.overdueReminders}</span> recordatorio{stats.overdueReminders !== 1 ? 's' : ''} vencido{stats.overdueReminders !== 1 ? 's' : ''}.{' '}
            <a href="/reminders" className="underline text-red-400 hover:text-red-300">Ver recordatorios</a>
          </p>
        </div>
      )}
    </div>
  );
}
