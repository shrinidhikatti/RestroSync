import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const fmt  = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const METHOD_COLORS: Record<string, string> = {
  CASH: '#10b981', CARD: '#3b82f6', UPI: '#f59e0b',
  WALLET: '#8b5cf6', CREDIT: '#ef4444', TIP: '#14b8a6',
};

const PRESETS = [
  { label: 'Today',        days: 0  },
  { label: 'Last 7 days',  days: 7  },
  { label: 'Last 30 days', days: 30 },
  { label: 'This Month',   days: -1 },
];

function kpiDate(days: number) {
  const to = new Date();
  let from: Date;
  if (days === 0)       { from = new Date(to); from.setHours(0, 0, 0, 0); }
  else if (days === -1) { from = new Date(to.getFullYear(), to.getMonth(), 1); }
  else                  { from = new Date(Date.now() - days * 86400_000); }
  return { from, to };
}

function KpiCard({ label, value, sub, color = 'text-slate-800' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 font-display ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function PnLPage() {
  const [preset, setPreset]   = useState(2);
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExp]   = useState(false);

  useEffect(() => { load(); }, [preset]);

  async function load() {
    setLoading(true);
    const { from, to } = kpiDate(PRESETS[preset].days);
    try {
      const r = await axios.get(`${API}/api/v1/integrations/accounting/pnl`, {
        params: { from: from.toISOString(), to: to.toISOString() },
      });
      setData(r.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function exportTally() {
    setExp(true);
    const { from, to } = kpiDate(PRESETS[preset].days);
    try {
      const resp = await axios.get(`${API}/api/v1/integrations/accounting/tally-export`, {
        params: { from: from.toISOString(), to: to.toISOString() },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/xml' }));
      const a = document.createElement('a'); a.href = url; a.download = 'tally-export.xml'; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExp(false);
    }
  }

  const rev = data?.revenue;
  const byMethod = data?.byPaymentMethod
    ? Object.entries(data.byPaymentMethod).map(([method, amount]) => ({ method, amount: Number(amount) }))
    : [];

  const barData = rev ? [
    { name: 'Gross Sales', value: rev.grossSales },
    { name: 'Discounts',   value: rev.discounts },
    { name: 'Tax',         value: rev.taxCollected },
    { name: 'Service',     value: rev.charges },
    { name: 'Refunds',     value: rev.totalRefunds },
    { name: 'Net Revenue', value: rev.netRevenue },
  ] : [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 anim-fade-up flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-slate-900 text-2xl">P&amp;L Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Profit &amp; Loss summary + Tally XML export</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Preset tabs */}
          <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setPreset(i)}
                className={`px-4 py-2 text-sm font-medium font-display transition-colors ${
                  preset === i ? 'bg-amber-400 text-slate-900' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={exportTally}
            disabled={exporting || !data}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : '⬇ Tally XML'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : !data ? (
        <div className="text-center bg-white border border-slate-100 rounded-2xl py-16">
          <p className="text-slate-400 font-display">No data available for this period.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* KPI rows */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Gross Sales"   value={fmt(rev.grossSales)} />
            <KpiCard label="Net Revenue"   value={fmt(rev.netRevenue)}   color="text-emerald-600" />
            <KpiCard label="Tax Collected" value={fmt(rev.taxCollected)} color="text-blue-600" />
            <KpiCard label="Refunds"       value={fmt(rev.totalRefunds)} color="text-rose-600" sub={`${data.refundCount} refunds`} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Discounts"       value={fmt(rev.discounts)} color="text-amber-600" />
            <KpiCard label="Service Charges" value={fmt(rev.charges)} />
            <KpiCard label="Tips"            value={fmt(rev.tips)} color="text-purple-600" />
            <KpiCard label="Bills"           value={data.billCount.toString()} sub="paid bills" />
          </div>

          {/* Bar chart */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-4 font-display">Revenue Breakdown</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                  formatter={(v: number | undefined) => [fmt(v ?? 0), '']}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.name === 'Net Revenue' ? '#10b981' : entry.name === 'Discounts' || entry.name === 'Refunds' ? '#f87171' : '#f59e0b'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Payment method pie */}
          {byMethod.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800 mb-4 font-display">Collections by Payment Method</h2>
              <div className="flex items-center gap-8">
                <ResponsiveContainer width={220} height={220}>
                  <PieChart>
                    <Pie data={byMethod} dataKey="amount" nameKey="method" innerRadius={55} outerRadius={90}>
                      {byMethod.map((entry) => (
                        <Cell key={entry.method} fill={METHOD_COLORS[entry.method] ?? '#64748b'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}
                      formatter={(v: number | undefined) => [fmt(v ?? 0), '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {byMethod.map((e) => (
                    <div key={e.method} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: METHOD_COLORS[e.method] ?? '#64748b' }} />
                        <span className="text-sm text-slate-600 font-display">{e.method}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{fmt(e.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tally info */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-xl mt-0.5">📊</span>
            <div>
              <p className="text-sm font-semibold text-amber-800 font-display">Tally Prime Export</p>
              <p className="text-xs text-amber-700 mt-1">
                Download the XML file and import it into Tally Prime via Gateway → Import Data → All Masters.
                Each paid bill becomes a Sales Voucher with CGST, SGST ledger entries.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
