import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import api from '../../lib/axios';
import { PlusIcon, GridIcon, ReceiptIcon, ArrowUpIcon, ArrowDownIcon, RefreshIcon } from '../../components/ui/Icons';

interface Stats {
  todayOrders: number;
  todayRevenue: number;
  activeTables: number;
  pendingKots: number;
}

interface RecentOrder {
  id: string;
  orderType: string;
  status: string;
  grandTotal: number;
  createdAt: string;
  table?: { number: string };
}

const statCards = [
  {
    key: 'todayOrders',
    label: "Today's Orders",
    icon: ReceiptIcon,
    color: 'bg-blue-50 text-blue-600',
    trend: '+12%',
    up: true,
  },
  {
    key: 'todayRevenue',
    label: "Today's Revenue",
    icon: ArrowUpIcon,
    color: 'bg-emerald-50 text-emerald-600',
    trend: '+8.3%',
    up: true,
    prefix: '₹',
  },
  {
    key: 'activeTables',
    label: 'Active Tables',
    icon: GridIcon,
    color: 'bg-amber-50 text-amber-600',
    trend: '-2',
    up: false,
  },
  {
    key: 'pendingKots',
    label: 'Pending KOTs',
    icon: RefreshIcon,
    color: 'bg-rose-50 text-rose-600',
    trend: '3 urgent',
    up: false,
  },
];

const statusColor: Record<string, string> = {
  NEW:       'bg-blue-100 text-blue-700',
  ACCEPTED:  'bg-indigo-100 text-indigo-700',
  PREPARING: 'bg-amber-100 text-amber-700',
  READY:     'bg-emerald-100 text-emerald-700',
  BILLED:    'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-rose-100 text-rose-600',
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats>({ todayOrders: 0, todayRevenue: 0, activeTables: 0, pendingKots: 0 });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [wipingDemo, setWipingDemo] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tablesRes, menuRes] = await Promise.allSettled([
          api.get('/tables'),
          api.get('/menu/items'),
        ]);

        if (tablesRes.status === 'fulfilled') {
          const tables = tablesRes.value.data;
          const activeTables = tables.filter((t: any) => t.status === 'OCCUPIED').length;
          setStats((s) => ({ ...s, activeTables }));
        }
        if (menuRes.status === 'fulfilled') {
          const items: any[] = menuRes.value.data ?? [];
          setIsDemoMode(items.some((i) => i.name?.startsWith('[DEMO]')));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSeedDemo = async () => {
    setSeedingDemo(true);
    try {
      await api.post('/demo/seed');
      setIsDemoMode(true);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Failed to seed demo data.');
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleWipeDemo = async () => {
    if (!confirm('This will delete all demo data. Continue?')) return;
    setWipingDemo(true);
    try {
      await api.delete('/demo/wipe');
      setIsDemoMode(false);
    } catch {
      alert('Failed to wipe demo data.');
    } finally {
      setWipingDemo(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 anim-fade-up">
        <div>
          <p className="text-slate-500 text-sm mb-1">{greeting},</p>
          <h1 className="font-display font-bold text-slate-900 text-2xl">
            {user?.name ?? 'Owner'} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/tables"
            className="px-4 py-2.5 rounded-xl text-sm font-semibold font-display border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            View Tables
          </Link>
          <button className="px-4 py-2.5 rounded-xl text-sm font-semibold font-display text-slate-900 transition-all hover:brightness-95 shadow-sm" style={{ background: 'var(--accent)' }}>
            + New Order
          </button>
        </div>
      </div>

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 text-lg">⚠️</span>
            <div>
              <p className="font-semibold text-amber-800 text-sm">DEMO MODE — Data is not real</p>
              <p className="text-amber-600 text-xs">This account contains sample data for exploration. Wipe it before going live.</p>
            </div>
          </div>
          <button
            onClick={handleWipeDemo}
            disabled={wipingDemo}
            className="shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            {wipingDemo ? 'Wiping…' : 'Wipe Demo Data'}
          </button>
        </div>
      )}

      {/* Seed Demo (only shown when no demo data) */}
      {!isDemoMode && !loading && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="font-semibold text-slate-700 text-sm">Explore with Demo Data</p>
            <p className="text-slate-400 text-xs">Seed 30 menu items, 8 tables and 5 sample orders to try out all features.</p>
          </div>
          <button
            onClick={handleSeedDemo}
            disabled={seedingDemo}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {seedingDemo ? 'Seeding…' : 'Load Demo Data'}
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card, i) => (
          <div
            key={card.key}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm anim-fade-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium font-display flex items-center gap-0.5 ${card.up ? 'text-emerald-600' : 'text-rose-500'}`}>
                {card.up ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
                {card.trend}
              </span>
            </div>
            <p className="font-display font-bold text-2xl text-slate-900">
              {loading ? (
                <span className="skeleton inline-block w-16 h-7" />
              ) : (
                <>
                  {card.prefix ?? ''}{stats[card.key as keyof Stats].toLocaleString('en-IN')}
                </>
              )}
            </p>
            <p className="text-slate-500 text-sm mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 anim-fade-up delay-100">
          <h2 className="font-display font-semibold text-slate-800 text-base mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {[
              { label: 'New Order', icon: PlusIcon, color: 'bg-amber-500 text-slate-900', path: '#' },
              { label: 'View Tables', icon: GridIcon, color: 'bg-slate-800 text-white', path: '/tables' },
              { label: 'Reservations', icon: ReceiptIcon, color: 'bg-blue-500 text-white', path: '/reservations' },
              { label: 'Menu Items', icon: RefreshIcon, color: 'bg-emerald-500 text-white', path: '/menu/items' },
            ].map((action) => (
              <Link
                key={action.label}
                to={action.path}
                className={`flex items-center gap-3 w-full p-3 rounded-xl font-medium font-display text-sm transition-all hover:scale-[1.01] active:scale-[0.99] ${action.color}`}
              >
                <action.icon className="w-4 h-4" />
                {action.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm anim-fade-up delay-150">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="font-display font-semibold text-slate-800 text-base">Recent Orders</h2>
            <span className="text-xs text-slate-400 font-display">Last 10</span>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="skeleton w-16 h-4" />
                  <div className="skeleton flex-1 h-4" />
                  <div className="skeleton w-20 h-6 rounded-full" />
                  <div className="skeleton w-16 h-4" />
                </div>
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <ReceiptIcon className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-display text-sm">No orders yet today</p>
              <p className="text-xs mt-1">Orders will appear here as they come in</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Order</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Type</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-mono text-slate-700 text-xs">#{order.id.slice(-6).toUpperCase()}</span>
                        {order.table && <span className="ml-2 text-slate-400 text-xs">T{order.table.number}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-slate-500 font-display">{order.orderType}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium font-display ${statusColor[order.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-800 font-display">
                        ₹{Number(order.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
