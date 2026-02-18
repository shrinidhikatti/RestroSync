import { useState, useEffect, useCallback } from 'react';
import { reportsApi } from '../../lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function today() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color = 'slate',
}: {
  label: string; value: string | number; sub?: string; color?: 'rose' | 'orange' | 'amber' | 'slate';
}) {
  const colors = {
    rose:   'bg-rose-50 border-rose-200 text-rose-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    slate:  'bg-white border-slate-200 text-slate-700',
  };
  return (
    <div className={`rounded-2xl p-5 border ${colors[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold font-display">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FraudReportsPage() {
  const [from, setFrom] = useState(daysAgo(6));
  const [to,   setTo]   = useState(today());

  const [voidData,     setVoidData]     = useState<any>(null);
  const [discountData, setDiscountData] = useState<any>(null);
  const [loading,      setLoading]      = useState(false);

  const [activeTab, setActiveTab] = useState<'voids' | 'discounts'>('voids');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [v, d] = await Promise.all([
        reportsApi.voids(from, to),
        reportsApi.discounts(from, to),
      ]);
      setVoidData(v.data);
      setDiscountData(d.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const PRESETS = [
    { label: 'Today',    from: () => today(),    to: () => today()    },
    { label: 'Last 7d',  from: () => daysAgo(6), to: () => today()    },
    { label: 'Last 30d', from: () => daysAgo(29),to: () => today()    },
  ];
  const [preset, setPreset] = useState(1);

  function applyPreset(i: number) {
    setPreset(i);
    setFrom(PRESETS[i].from());
    setTo(PRESETS[i].to());
  }

  return (
    <div className="p-6 space-y-6 anim-fade-up">

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-800">Fraud & Risk Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Voids, cancellations, and discount abuse</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => applyPreset(i)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                preset === i
                  ? 'bg-amber-500 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-amber-300'
              }`}
            >
              {p.label}
            </button>
          ))}
          <input type="date" className="input text-xs py-1.5 w-36"
            value={from} onChange={(e) => { setPreset(-1); setFrom(e.target.value); }} />
          <span className="text-slate-400 text-xs">–</span>
          <input type="date" className="input text-xs py-1.5 w-36"
            value={to} onChange={(e) => { setPreset(-1); setTo(e.target.value); }} />
          <button
            onClick={loadAll}
            disabled={loading}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Apply'}
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Voided Bills" color="rose"
          value={voidData?.summary?.voidCount ?? '—'}
          sub={voidData?.summary ? fmt(voidData.summary.voidAmount) + ' voided' : undefined}
        />
        <StatCard
          label="Cash Returned" color="orange"
          value={voidData?.summary ? fmt(voidData.summary.cashReturned) : '—'}
          sub="from voided bills"
        />
        <StatCard
          label="Cancelled Orders" color="amber"
          value={voidData?.summary?.cancelCount ?? '—'}
          sub={voidData?.summary ? fmt(voidData.summary.cancelAmount) + ' cancelled' : undefined}
        />
        <StatCard
          label="Discount Abuse" color="slate"
          value={discountData?.totals?.discountCount ?? '—'}
          sub={discountData?.totals ? fmt(discountData.totals.totalAmount) + ' discounted' : undefined}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border border-slate-200 rounded-xl overflow-hidden w-fit">
        {(['voids', 'discounts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 text-sm font-semibold capitalize transition-colors ${
              activeTab === tab
                ? 'bg-amber-500 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab === 'voids' ? 'Voids & Cancellations' : 'Discount by Biller'}
          </button>
        ))}
      </div>

      {activeTab === 'voids' && (
        <div className="space-y-6">

          {/* Voided Bills table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Voided Bills</h2>
            </div>
            {!voidData || voidData.voidedBills.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No voided bills in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Bill #</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Reason</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Voided By</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Voided At</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Cash Return</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Order Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voidData.voidedBills.map((b: any) => (
                      <tr key={b.billId} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{b.billNumber}</td>
                        <td className="px-4 py-3 font-semibold text-rose-600">{fmt(b.grandTotal)}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">{b.voidReason ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                          {b.voidedBy ? b.voidedBy.slice(0, 10) + '…' : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(b.voidedAt)}</td>
                        <td className="px-4 py-3">
                          {b.cashReturnAmount != null
                            ? <span className="text-orange-600 font-semibold">{fmt(b.cashReturnAmount)}</span>
                            : <span className="text-slate-400">—</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">
                            {b.orderType ?? '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cancelled Orders table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Cancelled Orders</h2>
            </div>
            {!voidData || voidData.cancelledOrders.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No cancelled orders in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Order ID</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Cancel Reason</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Cancelled By</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Cancelled At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voidData.cancelledOrders.map((o: any) => (
                      <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {o.id.slice(0, 12)}…
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">
                            {o.orderType}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-orange-600">{fmt(Number(o.grandTotal))}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">{o.cancelReason ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                          {o.cancelledBy ? o.cancelledBy.slice(0, 10) + '…' : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(o.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'discounts' && (
        <div className="space-y-4">

          {/* Totals bar */}
          {discountData?.totals && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-amber-700 font-semibold">Total Discounts Given</p>
                <p className="text-xl font-bold text-amber-800">{discountData.totals.discountCount}</p>
              </div>
              <div>
                <p className="text-xs text-amber-700 font-semibold">Total Amount</p>
                <p className="text-xl font-bold text-amber-800">{fmt(discountData.totals.totalAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-amber-700 font-semibold">Orders Affected</p>
                <p className="text-xl font-bold text-amber-800">{discountData.totals.affectedOrders}</p>
              </div>
              <div>
                <p className="text-xs text-amber-700 font-semibold">Total Orders</p>
                <p className="text-xl font-bold text-amber-800">{discountData.totals.totalOrders}</p>
              </div>
            </div>
          )}

          {/* Biller-wise table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Discounts by Biller</h2>
              <p className="text-xs text-slate-400 mt-0.5">Sorted by total discount amount</p>
            </div>
            {!discountData || discountData.byBiller.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No discounts in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">User ID</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Discount Count</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Total Amount</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Orders Affected</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">% of All Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discountData.byBiller.map((b: any, i: number) => (
                      <tr key={b.userId} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {i === 0 && (
                              <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-xs font-bold rounded">HIGH</span>
                            )}
                            <span className="font-mono text-xs text-slate-600">{b.userId.slice(0, 18)}…</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 font-semibold">{b.discountCount}</td>
                        <td className="px-4 py-3 text-right font-bold text-amber-600">{fmt(b.totalAmount)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{b.affectedOrders}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-slate-200 rounded-full h-1.5">
                              <div
                                className="bg-amber-400 h-1.5 rounded-full"
                                style={{ width: `${Math.min(b.pctOfOrders, 100)}%` }}
                              />
                            </div>
                            <span className="text-slate-600 text-xs w-10 text-right">{b.pctOfOrders}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
