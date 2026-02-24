import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { reportsApi } from '../../lib/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function today() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
}

const PRESET_RANGES = [
  { label: 'Today',      from: () => today(),     to: () => today()     },
  { label: 'Yesterday',  from: () => daysAgo(1),  to: () => daysAgo(1)  },
  { label: 'Last 7d',   from: () => daysAgo(6),  to: () => today()     },
  { label: 'Last 30d',  from: () => daysAgo(29), to: () => today()     },
];

const PIE_COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444'];
const BAR_COLOR  = '#f59e0b';
const LINE_COLOR = '#3b82f6';

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent = false }: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-5 border ${accent
      ? 'bg-amber-50 border-amber-200'
      : 'bg-white border-slate-200'}`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold font-display ${accent ? 'text-red-600' : 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">{title}</h2>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activePreset, setActivePreset] = useState(2); // default Last 7d
  const [from, setFrom] = useState(daysAgo(6));
  const [to,   setTo]   = useState(today());

  const [summary,  setSummary]  = useState<any>(null);
  const [trend,    setTrend]    = useState<any[]>([]);
  const [hourly,   setHourly]   = useState<any[]>([]);
  const [items,    setItems]    = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t, h, i, p] = await Promise.all([
        reportsApi.summary(from, to),
        reportsApi.dailyTrend(from, to),
        reportsApi.hourly(from, to),
        reportsApi.items(from, to, 10),
        reportsApi.payments(from, to),
      ]);
      setSummary(s.data);
      setTrend(t.data);
      setHourly(h.data);
      setItems(i.data);
      setPayments(p.data);
    } catch (e) {
      // silent — empty states shown
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function applyPreset(idx: number) {
    const p = PRESET_RANGES[idx];
    setActivePreset(idx);
    setFrom(p.from());
    setTo(p.to());
  }

  // Comparative: compare current period vs previous period of same length
  const [prevSummary, setPrevSummary] = useState<any>(null);
  useEffect(() => {
    const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
    const prevTo   = new Date(new Date(from).getTime() - 86400000).toISOString().split('T')[0];
    const prevFrom = new Date(new Date(from).getTime() - days * 86400000).toISOString().split('T')[0];
    reportsApi.summary(prevFrom, prevTo)
      .then((r) => setPrevSummary(r.data))
      .catch(() => setPrevSummary(null));
  }, [from, to]);

  const changePct = (curr: number, prev: number) => {
    if (!prev) return null;
    const pct = ((curr - prev) / prev) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs prev period`;
  };

  return (
    <div className="p-6 space-y-8 anim-fade-up">
      {/* Header + Date Range */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-800">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Sales performance overview</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {PRESET_RANGES.map((p, i) => (
            <button
              key={p.label}
              onClick={() => applyPreset(i)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activePreset === i
                  ? 'bg-red-500 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-red-400'
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input
              type="date" value={from}
              onChange={(e) => { setActivePreset(-1); setFrom(e.target.value); }}
              className="input text-xs py-1.5 w-36"
            />
            <span className="text-slate-400 text-xs">–</span>
            <input
              type="date" value={to}
              onChange={(e) => { setActivePreset(-1); setTo(e.target.value); }}
              className="input text-xs py-1.5 w-36"
            />
          </div>
          <button
            onClick={loadAll}
            disabled={loading}
            className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Apply'}
          </button>
        </div>
      </div>

      {/* KPI Row */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <KpiCard
            label="Net Sales" accent
            value={fmt(summary.netSales)}
            sub={prevSummary ? changePct(summary.netSales, prevSummary.netSales) ?? undefined : undefined}
          />
          <KpiCard label="Gross Sales"    value={fmt(summary.totalSales)} />
          <KpiCard label="Orders"         value={summary.totalOrders.toString()}
            sub={prevSummary ? changePct(summary.totalOrders, prevSummary.totalOrders) ?? undefined : undefined} />
          <KpiCard label="Avg Order"      value={fmt(summary.avgOrderValue)} />
          <KpiCard label="Total Discounts" value={fmt(summary.totalDiscounts)} />
          <KpiCard label="Refunds"        value={fmt(summary.totalRefunds)} />
        </div>
      )}

      {/* Tax Summary bar */}
      {summary?.tax && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <SectionHeader title="Tax Collected" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-500">Total Tax</p>
              <p className="text-lg font-bold text-slate-800">{fmt(summary.tax.total)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">CGST</p>
              <p className="text-lg font-bold text-slate-800">{fmt(summary.tax.cgst)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">SGST</p>
              <p className="text-lg font-bold text-slate-800">{fmt(summary.tax.sgst)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">IGST</p>
              <p className="text-lg font-bold text-slate-800">{fmt(summary.tax.igst)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Daily Trend */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <SectionHeader title="Daily Sales Trend" />
          {trend.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                <Line type="monotone" dataKey="sales" stroke={LINE_COLOR} strokeWidth={2} dot={false} name="Sales" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Hourly Heatmap (bar) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <SectionHeader title="Hourly Sales Pattern" />
          {hourly.every((h) => h.sales === 0) ? (
            <p className="text-sm text-slate-400 py-10 text-center">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourly} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                <Bar dataKey="sales" fill={BAR_COLOR} radius={[3, 3, 0, 0]} name="Sales" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Top Items */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:col-span-2">
          <SectionHeader title="Top-Selling Items" />
          {items.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">No data</p>
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
                  {items.map((item, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 text-slate-400 text-xs pr-4">{i + 1}</td>
                      <td className="py-2 text-slate-700 pr-4">
                        {item.itemName}
                        {item.variantName && (
                          <span className="ml-1 text-xs text-slate-400">({item.variantName})</span>
                        )}
                      </td>
                      <td className="py-2 text-right font-semibold text-slate-800">{item.totalQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment Breakdown Pie */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <SectionHeader title="Payment Methods" />
          {payments.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">No data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={payments}
                    dataKey="total"
                    nameKey="method"
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={70}
                    paddingAngle={3}
                  >
                    {payments.map((_e, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
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

      {/* Voided Bills Summary */}
      {summary && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <SectionHeader title="Voids & Cancellations" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-500">Voided Bills</p>
              <p className="text-xl font-bold text-rose-600">{summary.voidedBills}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Voided Amount</p>
              <p className="text-xl font-bold text-rose-600">{fmt(summary.voidedAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Cancelled Orders</p>
              <p className="text-xl font-bold text-orange-500">{summary.cancelledOrders}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
