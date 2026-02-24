import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customerApi, loyaltyApi, creditApi } from '../../lib/api';

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold font-display text-slate-800">{value}</p>
    </div>
  );
}

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [customer,  setCustomer]  = useState<any>(null);
  const [loyalty,   setLoyalty]   = useState<any>(null);
  const [credit,    setCredit]    = useState<any>(null);
  const [loading,   setLoading]   = useState(true);

  const [activeTab, setActiveTab] = useState<'orders' | 'loyalty' | 'credit'>('orders');

  // Modals
  const [showSettle,   setShowSettle]   = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('CASH');
  const [settleNote,   setSettleNote]   = useState('');
  const [settling,     setSettling]     = useState(false);

  const [showAdjust,    setShowAdjust]    = useState(false);
  const [adjustPoints,  setAdjustPoints]  = useState('');
  const [adjustDesc,    setAdjustDesc]    = useState('');
  const [adjusting,     setAdjusting]     = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      customerApi.get(id),
      loyaltyApi.balance(id),
      creditApi.get(id).catch(() => null),
    ]).then(([c, l, cr]) => {
      setCustomer(c.data);
      setLoyalty(l.data);
      setCredit(cr?.data ?? null);
    }).finally(() => setLoading(false));
  }, [id]);

  async function handleSettle() {
    if (!credit || !settleAmount) return;
    setSettling(true);
    try {
      await creditApi.settle(credit.id, {
        amount: parseFloat(settleAmount),
        paymentMethod: settleMethod,
        notes: settleNote || undefined,
      });
      const cr = await creditApi.get(id!);
      setCredit(cr.data);
      setShowSettle(false);
      setSettleAmount('');
    } finally {
      setSettling(false);
    }
  }

  async function handleAdjust() {
    if (!adjustPoints || !adjustDesc) return;
    setAdjusting(true);
    try {
      await loyaltyApi.adjust(id!, { points: parseInt(adjustPoints), description: adjustDesc });
      const l = await loyaltyApi.balance(id!);
      setLoyalty(l.data);
      setShowAdjust(false);
      setAdjustPoints('');
      setAdjustDesc('');
    } finally {
      setAdjusting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="flex gap-2">
          {[0,1,2].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-bounce"
              style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!customer) return (
    <div className="p-6 text-center text-slate-400">Customer not found.</div>
  );

  return (
    <div className="p-6 space-y-6 anim-fade-up max-w-4xl">

      {/* Back + Header */}
      <div>
        <button onClick={() => navigate('/crm/customers')}
          className="text-sm text-slate-500 hover:text-amber-500 transition-colors mb-3">
          ← Back to Customers
        </button>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl font-bold text-red-600 font-display flex-shrink-0">
            {(customer.name?.[0] ?? customer.phone[0]).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold font-display text-slate-800">{customer.name ?? 'Unknown'}</h1>
            <p className="text-slate-500">{customer.phone}</p>
            {customer.email && <p className="text-sm text-slate-400">{customer.email}</p>}
          </div>
          {customer.tags && (
            <span className="ml-auto px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
              {customer.tags}
            </span>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total Orders"  value={customer.totalOrders} />
        <Stat label="Total Spend"   value={fmt(Number(customer.totalSpend))} />
        <Stat label="Loyalty Points" value={loyalty?.points ?? 0} />
        <Stat label="Credit Balance" value={credit ? fmt(credit.currentBalance) : 'No Account'} />
      </div>

      {/* Dates */}
      {(customer.birthday || customer.anniversary || customer.lastVisit) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-wrap gap-6">
          {customer.birthday    && <div><p className="text-xs text-slate-400">Birthday</p><p className="font-semibold">{fmtDate(customer.birthday)}</p></div>}
          {customer.anniversary && <div><p className="text-xs text-slate-400">Anniversary</p><p className="font-semibold">{fmtDate(customer.anniversary)}</p></div>}
          {customer.lastVisit   && <div><p className="text-xs text-slate-400">Last Visit</p><p className="font-semibold">{fmtDate(customer.lastVisit)}</p></div>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 border border-slate-200 rounded-xl overflow-hidden w-fit">
        {(['orders', 'loyalty', 'credit'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 text-sm font-semibold capitalize transition-colors ${
              activeTab === tab
                ? 'bg-red-500 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {(!customer.recentOrders || customer.recentOrders.length === 0) ? (
            <p className="text-center text-sm text-slate-400 py-10">No orders found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {customer.recentOrders.map((o: any) => (
                  <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500">{fmtDate(o.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">{o.orderType}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{o.status}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(Number(o.grandTotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Loyalty Tab */}
      {activeTab === 'loyalty' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700">Current Balance</p>
              <p className="text-3xl font-bold font-display text-amber-800">{loyalty?.points ?? 0} pts</p>
            </div>
            <button
              onClick={() => setShowAdjust(true)}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Adjust
            </button>
          </div>
          {customer.loyaltyPoints?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Description</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.loyaltyPoints.map((lp: any) => (
                    <tr key={lp.id} className="border-b border-slate-50">
                      <td className="px-4 py-3 text-slate-500">{fmtDate(lp.createdAt)}</td>
                      <td className="px-4 py-3 text-slate-600">{lp.description ?? '—'}</td>
                      <td className={`px-4 py-3 text-right font-bold ${lp.points >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {lp.points >= 0 ? '+' : ''}{lp.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Credit Tab */}
      {activeTab === 'credit' && (
        <div className="space-y-4">
          {!credit ? (
            <p className="text-center text-sm text-slate-400 py-10">No credit account. Create one from Credit Accounts page.</p>
          ) : (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Outstanding Balance</p>
                    <p className={`text-3xl font-bold font-display ${credit.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {fmt(credit.currentBalance)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Limit: {fmt(credit.creditLimit)}</p>
                  </div>
                  <button
                    onClick={() => setShowSettle(true)}
                    disabled={credit.currentBalance <= 0}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40"
                  >
                    Settle
                  </button>
                </div>
              </div>
              {credit.transactions?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Notes</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {credit.transactions.map((t: any) => (
                        <tr key={t.id} className="border-b border-slate-50">
                          <td className="px-4 py-3 text-slate-500">{fmtDate(t.createdAt)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              t.type === 'CHARGE' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>{t.type}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{t.notes ?? t.paymentMethod ?? '—'}</td>
                          <td className={`px-4 py-3 text-right font-bold ${
                            t.type === 'CHARGE' ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {t.type === 'CHARGE' ? '+' : '-'}{fmt(t.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Settle Modal */}
      {showSettle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm anim-scale-in">
            <h2 className="text-lg font-bold font-display text-slate-800 mb-4">Settle Credit</h2>
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
              <div>
                <label className="label">Notes</label>
                <input className="input" placeholder="Optional notes"
                  value={settleNote} onChange={(e) => setSettleNote(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowSettle(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600">Cancel</button>
              <button onClick={handleSettle} disabled={!settleAmount || settling}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {settling ? 'Processing…' : 'Settle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Loyalty Modal */}
      {showAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm anim-scale-in">
            <h2 className="text-lg font-bold font-display text-slate-800 mb-4">Adjust Loyalty Points</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Points (negative to deduct)</label>
                <input className="input" type="number" placeholder="e.g. 50 or -20"
                  value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} />
              </div>
              <div>
                <label className="label">Reason *</label>
                <input className="input" placeholder="Compensation, correction…"
                  value={adjustDesc} onChange={(e) => setAdjustDesc(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdjust(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600">Cancel</button>
              <button onClick={handleAdjust} disabled={!adjustPoints || !adjustDesc || adjusting}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {adjusting ? 'Saving…' : 'Adjust'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
