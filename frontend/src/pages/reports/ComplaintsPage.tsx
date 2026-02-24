import { useState, useEffect, useCallback } from 'react';
import { complaintsApi } from '../../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';

// ── Reason labels ─────────────────────────────────────────────────────────────

const REASON_LABEL: Record<string, string> = {
  QUALITY:        'Poor Quality',
  WRONG_ITEM:     'Wrong Item',
  FOREIGN_OBJECT: 'Foreign Object',
  COLD:           'Served Cold',
  QUANTITY:       'Small Portion',
  OTHER:          'Other',
};

const REASON_COLOR: Record<string, string> = {
  QUALITY:        '#ef4444',
  WRONG_ITEM:     '#f97316',
  FOREIGN_OBJECT: '#7c3aed',
  COLD:           '#3b82f6',
  QUANTITY:       '#f59e0b',
  OTHER:          '#6b7280',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
}

const PRESETS = [
  { label: 'Today',    from: () => today(),     to: () => today()    },
  { label: 'Last 7d',  from: () => daysAgo(6),  to: () => today()    },
  { label: 'Last 30d', from: () => daysAgo(29), to: () => today()    },
];

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, danger = false }: {
  label: string; value: string | number; sub?: string; danger?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-5 border ${danger ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold font-display ${danger ? 'text-red-600' : 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ComplaintsPage() {
  const [preset, setPreset]       = useState(1); // Last 7d
  const [from,   setFrom]         = useState(daysAgo(6));
  const [to,     setTo]           = useState(today());
  const [analytics, setAnalytics] = useState<any>(null);
  const [recent,    setRecent]    = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, lRes] = await Promise.all([
        complaintsApi.analytics({ from, to }),
        complaintsApi.list({ from, to, limit: 50 }),
      ]);
      setAnalytics(aRes.data);
      setRecent(lRes.data.data ?? []);
    } catch {
      setAnalytics(null);
      setRecent([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const applyPreset = (idx: number) => {
    setPreset(idx);
    setFrom(PRESETS[idx].from());
    setTo(PRESETS[idx].to());
  };

  const handleResolve = async (id: string) => {
    if (!resolutionText.trim()) return;
    try {
      await complaintsApi.resolve(id, resolutionText.trim());
      setResolving(null);
      setResolutionText('');
      load();
    } catch { /* noop */ }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 anim-fade-up">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-slate-900 text-2xl">Dish Quality Complaints</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Track customer complaints to spot quality problems early
          </p>
        </div>

        {/* Date range */}
        <div className="flex flex-wrap gap-2 items-center">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => applyPreset(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-display transition-colors ${
                preset === i ? 'text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              style={preset === i ? { background: 'var(--accent)' } : undefined}
            >
              {p.label}
            </button>
          ))}
          <input type="date" value={from} onChange={(e) => { setPreset(-1); setFrom(e.target.value); }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-display bg-white" />
          <span className="text-slate-400 text-xs">→</span>
          <input type="date" value={to} onChange={(e) => { setPreset(-1); setTo(e.target.value); }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-display bg-white" />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : !analytics ? (
        <p className="text-slate-400 text-sm">No data available.</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Complaints"
              value={analytics.totalComplaints}
              sub={`${from} → ${to}`}
              danger={analytics.totalComplaints > 0}
            />
            <KpiCard
              label="Most Reported Dish"
              value={analytics.topDishes[0]?.menuItemName ?? '—'}
              sub={analytics.topDishes[0] ? `${analytics.topDishes[0].count} complaints` : 'No complaints'}
            />
            <KpiCard
              label="Top Reason"
              value={analytics.byReason[0] ? REASON_LABEL[analytics.byReason[0].reason] : '—'}
              sub={analytics.byReason[0] ? `${analytics.byReason[0].count} times` : 'No complaints'}
            />
            <KpiCard
              label="Dishes Flagged"
              value={analytics.topDishes.filter((d: any) => d.count >= 3).length}
              sub="Items with 3+ complaints"
              danger={analytics.topDishes.filter((d: any) => d.count >= 3).length > 0}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Offending Dishes */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">
                Top Complained Dishes
              </h2>
              {analytics.topDishes.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">No complaints in this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={analytics.topDishes.slice(0, 8)}
                    layout="vertical"
                    margin={{ left: 10, right: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="menuItemName"
                      width={130}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${v} complaint${v !== 1 ? 's' : ''}`, 'Count']}
                    />
                    <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Complaint Trend */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">
                Daily Complaint Trend
              </h2>
              {analytics.trend.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">No complaints in this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={analytics.trend} margin={{ right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }}
                      tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => [v, 'Complaints']} />
                    <Line
                      type="monotone" dataKey="count" stroke="#ef4444"
                      strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Reason Breakdown */}
          {analytics.byReason.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">
                Breakdown by Reason
              </h2>
              <div className="flex flex-wrap gap-3">
                {analytics.byReason.map((r: any) => (
                  <div
                    key={r.reason}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                    style={{
                      borderColor: REASON_COLOR[r.reason] + '40',
                      background:  REASON_COLOR[r.reason] + '10',
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: REASON_COLOR[r.reason] }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-700 font-display">
                        {REASON_LABEL[r.reason]}
                      </p>
                      <p className="text-xs text-slate-500">{r.count} complaint{r.count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Complaints List */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700 font-display">Recent Complaints</h2>
            </div>

            {recent.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <p className="text-3xl mb-2">🎉</p>
                <p className="font-display text-sm font-medium">No complaints in this period!</p>
                <p className="text-xs mt-1">Great job maintaining quality.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    {['Date', 'Dish', 'Reason', 'Notes', 'Order', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recent.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 font-display">
                        {c.menuItemName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            background: (REASON_COLOR[c.reason] ?? '#6b7280') + '15',
                            color:      REASON_COLOR[c.reason] ?? '#6b7280',
                          }}
                        >
                          {REASON_LABEL[c.reason] ?? c.reason}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">
                        {c.notes || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-display">
                        {c.order?.tokenNumber ? `#${c.order.tokenNumber}` : c.orderId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">
                        {c.resolvedAt ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Resolved
                          </span>
                        ) : resolving === c.id ? (
                          <div className="flex gap-2 items-center">
                            <input
                              value={resolutionText}
                              onChange={(e) => setResolutionText(e.target.value)}
                              placeholder="How was it resolved?"
                              className="px-2 py-1 rounded-lg border border-slate-200 text-xs w-40"
                              onKeyDown={(e) => e.key === 'Enter' && handleResolve(c.id)}
                              autoFocus
                            />
                            <button
                              onClick={() => handleResolve(c.id)}
                              className="px-2 py-1 rounded-lg text-xs font-semibold text-white"
                              style={{ background: 'var(--accent)' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => { setResolving(null); setResolutionText(''); }}
                              className="text-xs text-slate-400 hover:text-slate-600"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setResolving(c.id); setResolutionText(''); }}
                            className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                          >
                            Pending
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
