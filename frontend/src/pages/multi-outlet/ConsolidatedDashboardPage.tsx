import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { multiOutletApi } from '../../lib/api';

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
function today() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
}

const BRANCH_COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#f97316'];
const PIE_COLORS    = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444'];

const PRESETS = [
  { label: 'Today',   from: () => today(),    to: () => today()    },
  { label: 'Last 7d', from: () => daysAgo(6), to: () => today()    },
  { label: 'Last 30d',from: () => daysAgo(29),to: () => today()    },
];

export default function ConsolidatedDashboardPage() {
  const [from,    setFrom]    = useState(daysAgo(6));
  const [to,      setTo]      = useState(today());
  const [preset,  setPreset]  = useState(1);

  const [overview,    setOverview]    = useState<any>(null);
  const [comparison,  setComparison]  = useState<any>(null);
  const [items,       setItems]       = useState<any[]>([]);
  const [payments,    setPayments]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, cmp, it, pay] = await Promise.all([
        multiOutletApi.overview(from, to),
        multiOutletApi.comparison(from, to),
        multiOutletApi.topItems(from, to, 10),
        multiOutletApi.payments(from, to),
      ]);
      setOverview(ov.data);
      setComparison(cmp.data);
      setItems(it.data);
      setPayments(pay.data);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function applyPreset(i: number) {
    setPreset(i);
    setFrom(PRESETS[i].from());
    setTo(PRESETS[i].to());
  }

  return (
    <div className="p-6 space-y-8 anim-fade-up">

      {/* Header + date controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-800">All Branches — Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">Consolidated performance across all outlets</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => applyPreset(i)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                preset === i ? 'bg-amber-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-amber-300'
              }`}>
              {p.label}
            </button>
          ))}
          <input type="date" className="input text-xs py-1.5 w-36" value={from}
            onChange={(e) => { setPreset(-1); setFrom(e.target.value); }} />
          <span className="text-slate-400 text-xs">–</span>
          <input type="date" className="input text-xs py-1.5 w-36" value={to}
            onChange={(e) => { setPreset(-1); setTo(e.target.value); }} />
          <button onClick={loadAll} disabled={loading}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Loading…' : 'Apply'}
          </button>
        </div>
      </div>

      {/* Totals KPI row */}
      {overview?.totals && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Sales',    value: fmt(overview.totals.totalSales),  accent: true },
            { label: 'Total Orders',   value: overview.totals.totalOrders },
            { label: 'Total Bills',    value: overview.totals.totalBills },
            { label: 'Cancellations',  value: overview.totals.cancelledOrders },
            { label: 'Discounts',      value: fmt(overview.totals.discounts) },
            { label: 'Tax',            value: fmt(overview.totals.tax) },
          ].map((k) => (
            <div key={k.label} className={`rounded-2xl p-5 border ${
              k.accent ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${k.accent ? 'text-amber-600' : 'text-slate-500'}`}>
                {k.label}
              </p>
              <p className={`text-2xl font-bold font-display ${k.accent ? 'text-amber-700' : 'text-slate-800'}`}>
                {k.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Per-branch table */}
      {overview?.branches && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Branch Performance</h2>
            {overview.topBranch && (
              <p className="text-xs text-slate-400 mt-0.5">
                Top branch: <span className="font-semibold text-amber-600">{overview.topBranch}</span>
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Branch</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Sales</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Orders</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Avg Order</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Discounts</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Tax</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Cancelled</th>
                </tr>
              </thead>
              <tbody>
                {overview.branches.map((b: any, i: number) => (
                  <tr key={b.branchId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: BRANCH_COLORS[i % BRANCH_COLORS.length] }} />
                        <span className="font-semibold text-slate-800">{b.branchName}</span>
                        {i === 0 && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded">Top</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(b.totalSales)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{b.totalOrders}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(b.avgOrderValue)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(b.discounts)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(b.tax)}</td>
                    <td className="px-4 py-3 text-right text-orange-500">{b.cancelledOrders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Branch comparison trend */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">Daily Sales by Branch</h2>
          {!comparison || comparison.chartData?.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={comparison.chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {(comparison.branches ?? []).map((name: string, i: number) => (
                  <Line key={name} type="monotone" dataKey={name}
                    stroke={BRANCH_COLORS[i % BRANCH_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">Payments (All Branches)</h2>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={payments} dataKey="total" nameKey="method"
                    cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                    {payments.map((_e: any, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {payments.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-slate-600">{p.method}</span>
                    </div>
                    <span className="font-semibold text-slate-700">{fmt(p.total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top items (consolidated) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">Top Items (All Branches)</h2>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 pr-4">#</th>
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 pr-4">Item</th>
                  <th className="text-right py-2 text-xs font-semibold text-slate-500">Qty Sold</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 text-slate-400 text-xs pr-4">{i + 1}</td>
                    <td className="py-2 text-slate-700 pr-4">
                      {item.itemName}
                      {item.variantName && <span className="ml-1 text-xs text-slate-400">({item.variantName})</span>}
                    </td>
                    <td className="py-2 text-right font-semibold text-slate-800">{item.totalQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
