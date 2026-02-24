import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { handoverApi, staffApi } from '../../lib/api';

interface ActiveOrder {
  id: string;
  orderType: string;
  status: string;
  grandTotal: number;
  table: { number: string; section: string | null } | null;
  tokenNumber: number | null;
  customerName: string | null;
  items: { itemName: string; quantity: number; status: string }[];
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

export function ShiftHandoverModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'review' | 'select' | 'done'>('review');
  const [myOrders, setMyOrders] = useState<ActiveOrder[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedCaptainId, setSelectedCaptainId] = useState('');
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [result, setResult] = useState<{ count: number; newCaptain: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep('review');
    setSelectedCaptainId('');
    setResult(null);
    setError('');
    loadData();
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, staffRes] = await Promise.all([
        handoverApi.myOrders(),
        staffApi.getAll(),
      ]);
      setMyOrders(ordersRes.data ?? []);
      // Only show active captains/waiters — exclude self (no userId here, filter by role)
      const captains = (staffRes.data ?? []).filter(
        (s: StaffMember) => ['CAPTAIN', 'WAITER', 'CASHIER', 'MANAGER'].includes(s.role),
      );
      setStaff(captains);
    } catch {
      setMyOrders([]);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  const handleHandover = async () => {
    if (!selectedCaptainId) return;
    setTransferring(true);
    setError('');
    try {
      const res = await handoverApi.reassign(selectedCaptainId);
      setResult({ count: res.data.count, newCaptain: res.data.newCaptain.name });
      setStep('done');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Transfer failed. Please try again.');
    } finally {
      setTransferring(false);
    }
  };

  const orderLabel = (o: ActiveOrder) => {
    if (o.table) return `T${o.table.number}${o.table.section ? ` · ${o.table.section}` : ''}`;
    if (o.tokenNumber) return `Token #${o.tokenNumber}`;
    return o.customerName ?? 'Walk-in';
  };

  const STATUS_COLOR: Record<string, string> = {
    NEW: 'bg-sky-100 text-sky-700',
    ACCEPTED: 'bg-blue-100 text-blue-700',
    PREPARING: 'bg-amber-100 text-amber-700',
    READY: 'bg-emerald-100 text-emerald-700',
    SERVED: 'bg-teal-100 text-teal-700',
    BILLED: 'bg-purple-100 text-purple-700',
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        step === 'done'
          ? 'Handover Complete'
          : step === 'select'
          ? 'Select Incoming Captain'
          : 'End Shift — Review Your Orders'
      }
      size="sm"
      footer={
        step === 'review' ? (
          <>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep('select')}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:brightness-95"
              style={{ background: 'var(--accent)' }}
            >
              {myOrders.length === 0 ? 'End Shift' : `Hand Over ${myOrders.length} Order${myOrders.length !== 1 ? 's' : ''}`}
            </button>
          </>
        ) : step === 'select' ? (
          <>
            <button
              onClick={() => setStep('review')}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
            >
              Back
            </button>
            <button
              onClick={handleHandover}
              disabled={!selectedCaptainId || transferring}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:brightness-95"
              style={{ background: 'var(--accent)' }}
            >
              {transferring ? 'Transferring…' : 'Confirm Handover'}
            </button>
          </>
        ) : (
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-xl text-sm font-semibold text-white hover:brightness-95"
            style={{ background: 'var(--accent)' }}
          >
            Done — End My Shift
          </button>
        )
      }
    >
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : step === 'review' ? (
        <div className="space-y-4">
          {myOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">✅</p>
              <p className="font-display font-semibold text-slate-700">No active orders</p>
              <p className="text-sm text-slate-400 mt-1">You're clear to end your shift.</p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-xl">⚠️</span>
                <p className="text-sm text-amber-800">
                  You have <strong>{myOrders.length} active order{myOrders.length !== 1 ? 's' : ''}</strong>. These will be handed over to the incoming captain before you leave.
                </p>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {myOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-100 bg-slate-50">
                    <div>
                      <p className="font-display font-semibold text-slate-800 text-sm">{orderLabel(o)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {o.items.length} item{o.items.length !== 1 ? 's' : ''} ·{' '}
                        ₹{Number(o.grandTotal).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-display font-medium ${STATUS_COLOR[o.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {o.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : step === 'select' ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Select the captain who is taking over your tables. All {myOrders.length} order{myOrders.length !== 1 ? 's' : ''} will be reassigned instantly.
          </p>

          {error && (
            <div className="px-3 py-2.5 bg-rose-50 rounded-xl border border-rose-200 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {staff.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No other staff members found.</p>
            ) : (
              staff.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedCaptainId(s.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    selectedCaptainId === s.id
                      ? 'border-red-500 bg-red-50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold font-display flex-shrink-0"
                    style={{
                      background: selectedCaptainId === s.id ? '#ef4444' : '#f1f5f9',
                      color:      selectedCaptainId === s.id ? '#fff' : '#64748b',
                    }}
                  >
                    {s.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-slate-800 text-sm truncate">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.role}</p>
                  </div>
                  {selectedCaptainId === s.id && (
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Done */
        <div className="text-center py-6 space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-display font-bold text-slate-800 text-lg">Handover Successful</p>
            <p className="text-sm text-slate-500 mt-1">
              {result?.count} order{(result?.count ?? 0) !== 1 ? 's' : ''} transferred to{' '}
              <strong className="text-slate-700">{result?.newCaptain}</strong>.
            </p>
          </div>
          <p className="text-xs text-slate-400">
            The incoming captain now sees all your tables on their floor plan and KDS.
          </p>
        </div>
      )}
    </Modal>
  );
}
