import { useEffect, useState } from 'react';
import { dayCloseApi } from '../../lib/api';

interface DayCloseStatus {
  businessDate: string;
  status: 'INITIATED' | 'COMPLETED' | null;
  isLocked: boolean;
  startedAt: string | null;
  completedAt: string | null;
}

interface UnbilledOrder {
  id: string;
  orderType: string;
  status: string;
  grandTotal: number;
  table: { number: string } | null;
  customerName: string | null;
  tokenNumber: number | null;
  _count: { items: number };
}

const STATUS_COLOR: Record<string, string> = {
  NEW: 'bg-sky-100 text-sky-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-amber-100 text-amber-700',
  READY: 'bg-emerald-100 text-emerald-700',
  SERVED: 'bg-teal-100 text-teal-700',
};

export default function DayClosePage() {
  const [dcStatus, setDcStatus] = useState<DayCloseStatus | null>(null);
  const [unbilled, setUnbilled] = useState<UnbilledOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'check' | 'cash' | 'done'>('check');

  // Cash reconciliation form
  const [cashInDrawer, setCashInDrawer] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completeResult, setCompleteResult] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statusRes, unbilledRes] = await Promise.all([
        dayCloseApi.getStatus(),
        dayCloseApi.getUnbilled(),
      ]);
      setDcStatus(statusRes.data);
      setUnbilled(unbilledRes.data ?? []);
      if (statusRes.data?.status === 'COMPLETED') setStep('done');
      else if (statusRes.data?.status === 'INITIATED') setStep('cash');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCarryForward = async () => {
    setError('');
    setSubmitting(true);
    try {
      await dayCloseApi.carryForward();
      setUnbilled([]);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Carry-forward failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInitiate = async () => {
    setError('');
    setSubmitting(true);
    try {
      await dayCloseApi.initiate();
      setStep('cash');
      const statusRes = await dayCloseApi.getStatus();
      setDcStatus(statusRes.data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Cannot initiate day close.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await dayCloseApi.complete({
        cashInDrawer: parseFloat(cashInDrawer) || 0,
        notes: notes || undefined,
      });
      setCompleteResult(res.data);
      setStep('done');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to complete day close.');
    } finally {
      setSubmitting(false);
    }
  };

  const orderLabel = (o: UnbilledOrder) => {
    if (o.table) return `Table T${o.table.number}`;
    if (o.tokenNumber) return `Token #${o.tokenNumber}`;
    return o.customerName ?? 'Walk-in';
  };

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 anim-fade-up">
        <h1 className="font-display font-bold text-slate-900 text-2xl">Day Close</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Business date: <span className="font-medium text-slate-700">{dcStatus?.businessDate}</span>
        </p>
      </div>

      {/* Already completed */}
      {step === 'done' && (
        <div className="space-y-5 anim-fade-up">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-display font-bold text-emerald-800 text-xl">Day Successfully Closed</p>
            <p className="text-sm text-emerald-600 mt-1">
              Completed at {dcStatus?.completedAt ? new Date(dcStatus.completedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </p>
          </div>

          {completeResult && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6 space-y-3 shadow-sm">
              <h2 className="font-display font-semibold text-slate-800 text-lg mb-4">Cash Reconciliation Summary</h2>
              {[
                { label: 'Cash Sales', value: completeResult.cashSales },
                { label: 'Cash in Drawer', value: completeResult.cashInDrawer },
                { label: 'Expected (Sales + Opening)', value: completeResult.cashExpected },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-800">₹{Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-3 flex justify-between">
                <span className="font-display font-semibold text-slate-700">Variance</span>
                <span className={`font-bold text-base ${Number(completeResult.variance) < 0 ? 'text-rose-600' : Number(completeResult.variance) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {Number(completeResult.variance) >= 0 ? '+' : ''}₹{Number(completeResult.variance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-slate-400">
            The system will reset for the new business day automatically at 05:00 AM.
          </p>
        </div>
      )}

      {/* Step 1: Check unbilled orders → Initiate */}
      {step === 'check' && (
        <div className="space-y-5 anim-fade-up">
          {/* Unbilled orders warning */}
          {unbilled.length > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-display font-semibold text-amber-800">
                    {unbilled.length} Unbilled Order{unbilled.length !== 1 ? 's' : ''} Pending
                  </p>
                  <p className="text-sm text-amber-700 mt-0.5">
                    You must carry forward or settle all open orders before closing the day.
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {unbilled.map((o) => (
                  <div key={o.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-amber-100">
                    <div>
                      <p className="font-display font-semibold text-slate-800 text-sm">{orderLabel(o)}</p>
                      <p className="text-xs text-slate-400">{o._count.items} item{o._count.items !== 1 ? 's' : ''} · ₹{Number(o.grandTotal).toLocaleString('en-IN')}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-display font-medium ${STATUS_COLOR[o.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {o.status}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleCarryForward}
                disabled={submitting}
                className="mt-4 w-full px-4 py-2.5 rounded-xl text-sm font-semibold font-display border-2 border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Moving...' : `Carry Forward All ${unbilled.length} Order${unbilled.length !== 1 ? 's' : ''} to Tomorrow`}
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-display font-semibold text-emerald-800">All Orders Settled</p>
                <p className="text-sm text-emerald-600">No open orders for today. You can close the day.</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-rose-50 rounded-xl border border-rose-200 text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* Initiate close */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <h2 className="font-display font-semibold text-slate-800 mb-1">Close Today's Business Day</h2>
            <p className="text-sm text-slate-500 mb-5">
              This will lock the books for <strong>{dcStatus?.businessDate}</strong>. After initiating, you'll enter the cash in your drawer to reconcile the day.
            </p>
            <button
              onClick={handleInitiate}
              disabled={submitting || unbilled.length > 0}
              className="w-full px-4 py-3 rounded-xl text-sm font-semibold font-display text-white disabled:opacity-50 transition-colors"
              style={{ background: unbilled.length > 0 ? '#94a3b8' : 'var(--accent)' }}
            >
              {submitting ? 'Initiating…' : 'Initiate Day Close →'}
            </button>
            {unbilled.length > 0 && (
              <p className="text-xs text-center text-slate-400 mt-2">Carry forward open orders first</p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Cash Reconciliation */}
      {step === 'cash' && (
        <div className="space-y-5 anim-fade-up">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="font-display font-semibold text-blue-800">Day Close Initiated</p>
              <p className="text-sm text-blue-700 mt-0.5">
                Books are locked for {dcStatus?.businessDate}. Enter the cash in your drawer to complete reconciliation.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-5">
            <h2 className="font-display font-semibold text-slate-800 text-lg">Cash Reconciliation</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">
                Cash in Drawer <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashInDrawer}
                  onChange={(e) => setCashInDrawer(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-semibold text-slate-800"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Count all cash physically in the drawer/till</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any discrepancy notes, manager remarks…"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>

            {error && (
              <div className="px-4 py-3 bg-rose-50 rounded-xl border border-rose-200 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              onClick={handleComplete}
              disabled={submitting || !cashInDrawer}
              className="w-full px-4 py-3 rounded-xl text-sm font-semibold font-display text-white disabled:opacity-50 hover:brightness-95 transition-all"
              style={{ background: 'var(--accent)' }}
            >
              {submitting ? 'Completing Day Close…' : 'Complete Day Close & Submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
