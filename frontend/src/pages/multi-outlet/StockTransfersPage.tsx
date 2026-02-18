import { useState, useEffect, useCallback } from 'react';
import { multiOutletApi, ingredientApi } from '../../lib/api';
import axios from 'axios';

const branchesApi = {
  list: () => axios.get(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'}/branches`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
  }),
};

function fmt(n: number | string) {
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

export default function StockTransfersPage() {
  const [transfers,    setTransfers]    = useState<any[]>([]);
  const [branches,     setBranches]     = useState<any[]>([]);
  const [ingredients,  setIngredients]  = useState<any[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [updating,     setUpdating]     = useState<string | null>(null);

  // Create modal
  const [showCreate,    setShowCreate]    = useState(false);
  const [toBranchId,    setToBranchId]    = useState('');
  const [ingredientId,  setIngredientId]  = useState('');
  const [quantity,      setQuantity]      = useState('');
  const [unit,          setUnit]          = useState('');
  const [notes,         setNotes]         = useState('');
  const [creating,      setCreating]      = useState(false);
  const [createError,   setCreateError]   = useState('');

  useEffect(() => {
    Promise.all([branchesApi.list(), ingredientApi.list()])
      .then(([b, i]) => {
        const bList = b.data?.data ?? b.data ?? [];
        setBranches(bList);
        if (bList.length > 0) setToBranchId(bList[0].id);
        const iList = i.data?.data ?? i.data ?? [];
        setIngredients(iList);
        if (iList.length > 0) {
          setIngredientId(iList[0].id);
          setUnit(iList[0].unit ?? '');
        }
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await multiOutletApi.listTransfers();
      setTransfers(r.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!toBranchId || !ingredientId || !quantity) return;
    setCreating(true);
    setCreateError('');
    try {
      await multiOutletApi.createTransfer({
        toBranchId,
        ingredientId,
        quantity: parseFloat(quantity),
        unit: unit || 'units',
        notes: notes || undefined,
      });
      setShowCreate(false);
      setQuantity('');
      setNotes('');
      load();
    } catch (e: any) {
      setCreateError(e?.response?.data?.message ?? 'Failed to create transfer');
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusUpdate(id: string, status: 'COMPLETED' | 'CANCELLED') {
    setUpdating(id);
    try {
      await multiOutletApi.updateTransfer(id, status);
      load();
    } finally {
      setUpdating(null);
    }
  }

  function onIngredientChange(id: string) {
    setIngredientId(id);
    const ing = ingredients.find((i) => i.id === id);
    if (ing) setUnit(ing.unit ?? '');
  }

  return (
    <div className="p-6 space-y-6 anim-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-800">Inter-Branch Stock Transfers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Move stock between branches</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + New Transfer
        </button>
      </div>

      {/* Transfers table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="flex gap-2">
              {[0,1,2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-amber-400 animate-bounce"
                  style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          </div>
        ) : transfers.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-16">No stock transfers yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">From</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">To</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Ingredient</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Quantity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Date</th>
                <th className="w-36 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {transfers.map((t: any) => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700 font-medium">{t.fromBranch?.name ?? t.fromBranchId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{t.toBranch?.name ?? t.toBranchId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-slate-600">{t.ingredientId.slice(0, 12)}…</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {fmt(t.quantity)} {t.unit}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[t.status] ?? 'bg-slate-100'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {t.status === 'PENDING' && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleStatusUpdate(t.id, 'COMPLETED')}
                          disabled={updating === t.id}
                          className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(t.id, 'CANCELLED')}
                          disabled={updating === t.id}
                          className="px-3 py-1 bg-slate-200 hover:bg-rose-100 text-slate-600 hover:text-rose-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Transfer Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md anim-scale-in">
            <h2 className="text-lg font-bold font-display text-slate-800 mb-4">New Stock Transfer</h2>
            <div className="space-y-3">
              <div>
                <label className="label">To Branch</label>
                <select className="input text-sm" value={toBranchId} onChange={(e) => setToBranchId(e.target.value)}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Ingredient</label>
                <select className="input text-sm" value={ingredientId} onChange={(e) => onIngredientChange(e.target.value)}>
                  {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Quantity</label>
                  <input className="input" type="number" min="0.001" step="0.001" placeholder="0.000"
                    value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <input className="input" placeholder="kg, L, pcs…"
                    value={unit} onChange={(e) => setUnit(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <input className="input" placeholder="Optional notes…"
                  value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              {createError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
                  {createError}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowCreate(false); setCreateError(''); }}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600">Cancel</button>
              <button onClick={handleCreate} disabled={!toBranchId || !ingredientId || !quantity || creating}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {creating ? 'Creating…' : 'Create Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
