import { useState, useEffect, useCallback } from 'react';
import { creditApi } from '../../lib/api';

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CreditAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [aging,    setAging]    = useState<any>(null);
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState<'list' | 'aging'>('list');

  // Modals
  const [showSettle,   setShowSettle]   = useState(false);
  const [selectedAcc,  setSelectedAcc]  = useState<any>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('CASH');
  const [settling,     setSettling]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [acc, ag] = await Promise.all([creditApi.list(), creditApi.aging()]);
      setAccounts(acc.data);
      setAging(ag.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSettle() {
    if (!selectedAcc || !settleAmount) return;
    setSettling(true);
    try {
      await creditApi.settle(selectedAcc.id, {
        amount: parseFloat(settleAmount),
        paymentMethod: settleMethod,
      });
      setShowSettle(false);
      setSettleAmount('');
      setSelectedAcc(null);
      load();
    } finally {
      setSettling(false);
    }
  }

  return (
    <div className="p-6 space-y-6 anim-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-800">Credit Accounts (Khata)</h1>
          <p className="text-sm text-slate-500 mt-0.5">Customer credit balances and settlements</p>
        </div>
      </div>

      {/* Aging summary */}
      {aging && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Outstanding</p>
            <p className="text-2xl font-bold font-display text-rose-600 mt-0.5">{fmt(aging.totalOutstanding)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Current (≤30d)</p>
            <p className="text-2xl font-bold font-display text-slate-800 mt-0.5">{fmt(aging.current.total)}</p>
            <p className="text-xs text-slate-400">{aging.current.count} accounts</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Overdue 30-60d</p>
            <p className="text-2xl font-bold font-display text-orange-700 mt-0.5">{fmt(aging.overdue30.total)}</p>
            <p className="text-xs text-orange-500">{aging.overdue30.count} accounts</p>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide">Overdue &gt;60d</p>
            <p className="text-2xl font-bold font-display text-rose-700 mt-0.5">{fmt(aging.overdue60.total)}</p>
            <p className="text-xs text-rose-500">{aging.overdue60.count} accounts</p>
          </div>
        </div>
      )}

      {/* Tab toggle */}
      <div className="flex gap-0 border border-slate-200 rounded-xl overflow-hidden w-fit">
        {(['list', 'aging'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t ? 'bg-red-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t === 'list' ? 'All Accounts' : 'Aging Report'}
          </button>
        ))}
      </div>

      {/* All Accounts */}
      {tab === 'list' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="flex gap-2">
                {[0,1,2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-bounce"
                    style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-12">No credit accounts yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Phone</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Balance</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Limit</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Last Payment</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a: any) => (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{a.customerName ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{a.customerPhone}</td>
                    <td className={`px-4 py-3 text-right font-bold ${a.currentBalance > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {fmt(a.currentBalance)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">{fmt(a.creditLimit)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {a.daysSincePayment != null
                        ? `${a.daysSincePayment}d ago`
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {a.overdue
                        ? <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-semibold rounded-full">Overdue</span>
                        : a.isActive
                        ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">Active</span>
                        : <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full">Inactive</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.currentBalance > 0 && a.isActive && (
                        <button
                          onClick={() => { setSelectedAcc(a); setShowSettle(true); }}
                          className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          Settle
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Aging Report */}
      {tab === 'aging' && aging && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Customer</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Balance</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Days Since Payment</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Risk</th>
              </tr>
            </thead>
            <tbody>
              {aging.accounts
                .sort((a: any, b: any) => (b.daysSincePayment ?? 0) - (a.daysSincePayment ?? 0))
                .map((a: any) => (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{a.customerName ?? '—'}</p>
                      <p className="text-xs text-slate-400">{a.customerPhone}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600">{fmt(a.currentBalance)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {a.daysSincePayment != null ? `${a.daysSincePayment} days` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {!a.daysSincePayment || a.daysSincePayment <= 30
                        ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">Low</span>
                        : a.daysSincePayment <= 60
                        ? <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">Medium</span>
                        : <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-semibold rounded-full">High</span>
                      }
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Settle Modal */}
      {showSettle && selectedAcc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm anim-scale-in">
            <h2 className="text-lg font-bold font-display text-slate-800 mb-1">Settle Credit</h2>
            <p className="text-sm text-slate-500 mb-4">
              {selectedAcc.customerName} · Outstanding: {fmt(selectedAcc.currentBalance)}
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">Amount</label>
                <input className="input" type="number" placeholder="0.00"
                  value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">Payment Method</label>
                <select className="input" value={settleMethod} onChange={(e) => setSettleMethod(e.target.value)}>
                  {['CASH','CARD','UPI','BANK_TRANSFER'].map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowSettle(false); setSelectedAcc(null); setSettleAmount(''); }}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600">Cancel</button>
              <button onClick={handleSettle} disabled={!settleAmount || settling}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {settling ? 'Processing…' : 'Settle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
