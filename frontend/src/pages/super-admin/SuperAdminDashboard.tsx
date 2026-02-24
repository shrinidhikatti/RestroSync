import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { saApi } from './useSuperAdmin';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface PlatformStats {
  totalRestaurants: number;
  activeRestaurants: number;
  suspendedRestaurants: number;
  totalBranches: number;
  totalOrders: number;
  todayOrders: number;
}

const COLORS = ['#8b5cf6', '#f59e0b', '#10b981', '#ef4444'];

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const api = saApi();
    Promise.all([
      api.get('/super-admin/stats'),
      api.get('/super-admin/restaurants?limit=5'),
    ]).then(([statsRes, restRes]) => {
      setStats(statsRes.data);
      const data = restRes.data;
      setRestaurants(Array.isArray(data) ? data : data.data ?? []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const pieData = stats ? [
    { name: 'Active', value: stats.activeRestaurants },
    { name: 'Suspended', value: stats.suspendedRestaurants },
    { name: 'Other', value: Math.max(0, stats.totalRestaurants - stats.activeRestaurants - stats.suspendedRestaurants) },
  ] : [];

  const kpis = stats ? [
    { label: 'Total Restaurants', value: stats.totalRestaurants, icon: '🏪', color: 'bg-violet-500/10 border-violet-500/20 text-violet-400' },
    { label: 'Active', value: stats.activeRestaurants, icon: '✅', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
    { label: 'Suspended', value: stats.suspendedRestaurants, icon: '🚫', color: 'bg-rose-500/10 border-rose-500/20 text-rose-400' },
    { label: 'Total Branches', value: stats.totalBranches, icon: '🏬', color: 'bg-red-500/10 border-amber-500/20 text-amber-400' },
    { label: "Today's Orders", value: stats.todayOrders, icon: '📋', color: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
    { label: 'Total Orders', value: stats.totalOrders?.toLocaleString(), icon: '🧾', color: 'bg-slate-700 border-slate-600 text-slate-300' },
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex gap-2">{[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i*120}ms` }} />)}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>Platform Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">RestroSync — all restaurants, live stats</p>
        </div>
        <Link
          to="/super-admin/restaurants/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Restaurant
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-2xl border p-4 ${k.color}`}>
            <div className="text-2xl mb-1">{k.icon}</div>
            <p className="text-2xl font-bold mt-1">{k.value}</p>
            <p className="text-xs opacity-80 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Pie */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Restaurant Status</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1.5 mt-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                {d.name}: <span className="text-white font-medium ml-auto">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent restaurants table */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Recent Restaurants</h2>
            <Link to="/super-admin/restaurants" className="text-xs text-violet-400 hover:text-violet-300">View all →</Link>
          </div>
          <div className="space-y-2">
            {restaurants.slice(0, 5).map((r: any) => (
              <Link
                key={r.id}
                to={`/super-admin/restaurants/${r.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-800 flex items-center justify-center text-xs font-bold text-violet-200 flex-shrink-0">
                  {r.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{r.name}</p>
                  <p className="text-xs text-slate-500 truncate">{r.city || 'No city'} · {r.operatingMode || 'No mode'}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  r.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' :
                  r.status === 'SUSPENDED' ? 'bg-rose-500/10 text-rose-400' :
                  'bg-slate-700 text-slate-400'
                }`}>{r.status}</span>
              </Link>
            ))}
            {restaurants.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-4">No restaurants yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
