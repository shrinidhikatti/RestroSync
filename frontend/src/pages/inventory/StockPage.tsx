import React, { useEffect, useState } from 'react';
import { stockApi, ingredientApi } from '../../lib/api';
import toast from 'react-hot-toast';

interface StockLevel {
  id: string;
  ingredientId: string;
  currentQuantity: number;
  ingredient: { id: string; name: string; unit: string; minStockLevel: number | null };
}

interface StockBatch {
  id: string;
  ingredientId: string;
  batchNumber: string | null;
  purchaseDate: string;
  expiryDate: string | null;
  quantityIn: number;
  quantityRemaining: number;
  costPerUnit: number;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
}

type Tab = 'levels' | 'low-stock' | 'expiry' | 'transactions';

export default function StockPage() {
  const [tab, setTab] = useState<Tab>('levels');
  const [stockLevels, setStockLevels]           = useState<StockLevel[]>([]);
  const [lowStockAlerts, setLowStockAlerts]     = useState<StockLevel[]>([]);
  const [expiryAlerts, setExpiryAlerts]         = useState<StockBatch[]>([]);
  const [transactions, setTransactions]         = useState<any[]>([]);
  const [ingredients, setIngredients]           = useState<Ingredient[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showStockOutModal, setShowStockOutModal] = useState(false);

  const [stockInForm, setStockInForm] = useState({
    ingredientId: '', quantity: '', costPerUnit: '',
    batchNumber: '', purchaseDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
  });

  const [stockOutForm, setStockOutForm] = useState({
    ingredientId: '', quantity: '', type: 'WASTAGE', reason: '',
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [lvls, low, exp, txns, ings] = await Promise.all([
        stockApi.levels(),
        stockApi.lowStockAlerts(),
        stockApi.expiryAlerts(7),
        stockApi.transactions(undefined, 50),
        ingredientApi.list(),
      ]);
      setStockLevels(lvls.data);
      setLowStockAlerts(low.data);
      setExpiryAlerts(exp.data);
      setTransactions(txns.data);
      setIngredients(ings.data);
    } catch {
      toast.error('Failed to load stock data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleStockIn = async () => {
    if (!stockInForm.ingredientId || !stockInForm.quantity || !stockInForm.costPerUnit) {
      toast.error('Ingredient, quantity and cost are required');
      return;
    }
    try {
      await stockApi.stockIn({
        ingredientId: stockInForm.ingredientId,
        quantity:     parseFloat(stockInForm.quantity),
        costPerUnit:  parseFloat(stockInForm.costPerUnit),
        batchNumber:  stockInForm.batchNumber || undefined,
        purchaseDate: stockInForm.purchaseDate,
        expiryDate:   stockInForm.expiryDate || undefined,
      });
      toast.success('Stock added successfully');
      setShowStockInModal(false);
      loadAll();
    } catch {
      toast.error('Failed to add stock');
    }
  };

  const handleStockOut = async () => {
    if (!stockOutForm.ingredientId || !stockOutForm.quantity) {
      toast.error('Ingredient and quantity are required');
      return;
    }
    try {
      await stockApi.stockOut({
        ingredientId: stockOutForm.ingredientId,
        quantity:     parseFloat(stockOutForm.quantity),
        type:         stockOutForm.type as 'WASTAGE' | 'ADJUSTMENT',
        reason:       stockOutForm.reason || undefined,
      });
      toast.success('Stock deducted');
      setShowStockOutModal(false);
      loadAll();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to deduct stock');
    }
  };

  const handleWriteOff = async (batchId: string) => {
    if (!confirm('Write off all remaining stock in this batch?')) return;
    try {
      await stockApi.writeOffBatch(batchId);
      toast.success('Batch written off');
      loadAll();
    } catch {
      toast.error('Failed to write off batch');
    }
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'levels',       label: 'Stock Levels'  },
    { key: 'low-stock',    label: 'Low Stock Alerts', count: lowStockAlerts.length },
    { key: 'expiry',       label: 'Expiry Alerts',    count: expiryAlerts.length },
    { key: 'transactions', label: 'Transactions'  },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Management</h1>
          <p className="text-sm text-slate-500 mt-1">Track inventory levels and movements</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setStockOutForm({ ingredientId: '', quantity: '', type: 'WASTAGE', reason: '' }); setShowStockOutModal(true); }}
            className="border border-slate-200 text-slate-600 font-semibold px-4 py-2 rounded-xl text-sm"
          >
            Stock Out / Wastage
          </button>
          <button
            onClick={() => { setStockInForm({ ingredientId: '', quantity: '', costPerUnit: '', batchNumber: '', purchaseDate: new Date().toISOString().split('T')[0], expiryDate: '' }); setShowStockInModal(true); }}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-4 py-2 rounded-xl text-sm"
          >
            + Stock In
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-100">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {(t.count ?? 0) > 0 && (
              <span className="ml-2 bg-red-100 text-red-600 text-xs rounded-full px-2 py-0.5">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        </div>
      ) : (
        <>
          {/* Stock Levels */}
          {tab === 'levels' && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Ingredient', 'Current Stock', 'Min Level', 'Status'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stockLevels.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-12 text-slate-400">No stock data. Add stock-in entries to get started.</td></tr>
                  ) : stockLevels.map((s) => {
                    const isLow = s.ingredient.minStockLevel !== null
                      && Number(s.currentQuantity) <= Number(s.ingredient.minStockLevel);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{s.ingredient.name}</td>
                        <td className="px-4 py-3">
                          <span className={isLow ? 'text-red-600 font-bold' : 'text-slate-700'}>
                            {Number(s.currentQuantity).toFixed(3)} {s.ingredient.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {s.ingredient.minStockLevel
                            ? `${s.ingredient.minStockLevel} ${s.ingredient.unit}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {isLow ? (
                            <span className="bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full text-xs font-semibold">Low Stock</span>
                          ) : (
                            <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full text-xs font-semibold">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Low Stock Alerts */}
          {tab === 'low-stock' && (
            <div>
              {lowStockAlerts.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <div className="text-4xl mb-3">✅</div>
                  All stock levels are adequate
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {lowStockAlerts.map((s) => (
                    <div key={s.id} className="bg-white rounded-2xl border border-red-200 p-5">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-slate-800">{s.ingredient.name}</h3>
                        <span className="bg-red-50 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full border border-red-200">LOW</span>
                      </div>
                      <div className="text-2xl font-bold text-red-600">
                        {Number(s.currentQuantity).toFixed(2)} {s.ingredient.unit}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Min: {s.ingredient.minStockLevel} {s.ingredient.unit}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Expiry Alerts */}
          {tab === 'expiry' && (
            <div>
              {expiryAlerts.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <div className="text-4xl mb-3">✅</div>
                  No batches expiring within 7 days
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['Ingredient', 'Batch', 'Expiry Date', 'Remaining Qty', ''].map((h) => (
                          <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {expiryAlerts.map((b: any) => {
                        const daysLeft = Math.ceil(
                          (new Date(b.expiryDate).getTime() - Date.now()) / 86400000,
                        );
                        const isExpired = daysLeft <= 0;
                        return (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium">{b.ingredient?.name ?? '—'}</td>
                            <td className="px-4 py-3 text-slate-500">{b.batchNumber ?? 'No batch #'}</td>
                            <td className="px-4 py-3">
                              <span className={`font-semibold ${isExpired ? 'text-red-600' : 'text-amber-600'}`}>
                                {new Date(b.expiryDate).toLocaleDateString()}
                                <span className="ml-2 text-xs">
                                  ({isExpired ? 'EXPIRED' : `${daysLeft}d left`})
                                </span>
                              </span>
                            </td>
                            <td className="px-4 py-3">{Number(b.quantityRemaining).toFixed(2)} {b.ingredient?.unit}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleWriteOff(b.id)}
                                className="text-xs text-red-500 hover:text-red-700 font-semibold"
                              >
                                Write Off
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Transactions */}
          {tab === 'transactions' && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Ingredient', 'Type', 'Qty', 'Reason', 'Time'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-slate-400">No transactions yet</td></tr>
                  ) : transactions.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{t.ingredientId}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          t.type === 'PURCHASE'    ? 'bg-green-50 text-green-700' :
                          t.type === 'CONSUMPTION' ? 'bg-blue-50 text-blue-700'  :
                          t.type === 'WASTAGE'     ? 'bg-red-50 text-red-700'    :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">{Number(t.quantity).toFixed(3)}</td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-xs">{t.reason ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(t.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Stock-In Modal */}
      {showStockInModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Add Stock (Purchase)</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Ingredient *</label>
                <select
                  value={stockInForm.ingredientId}
                  onChange={(e) => setStockInForm({ ...stockInForm, ingredientId: e.target.value })}
                  className="input"
                >
                  <option value="">Select ingredient</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Quantity *</label>
                  <input type="number" min="0.001" step="0.001" value={stockInForm.quantity}
                    onChange={(e) => setStockInForm({ ...stockInForm, quantity: e.target.value })}
                    className="input" placeholder="0.000" />
                </div>
                <div>
                  <label className="label">Cost / Unit (₹) *</label>
                  <input type="number" min="0" step="0.01" value={stockInForm.costPerUnit}
                    onChange={(e) => setStockInForm({ ...stockInForm, costPerUnit: e.target.value })}
                    className="input" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Purchase Date *</label>
                  <input type="date" value={stockInForm.purchaseDate}
                    onChange={(e) => setStockInForm({ ...stockInForm, purchaseDate: e.target.value })}
                    className="input" />
                </div>
                <div>
                  <label className="label">Expiry Date</label>
                  <input type="date" value={stockInForm.expiryDate}
                    onChange={(e) => setStockInForm({ ...stockInForm, expiryDate: e.target.value })}
                    className="input" />
                </div>
              </div>
              <div>
                <label className="label">Batch Number</label>
                <input type="text" value={stockInForm.batchNumber}
                  onChange={(e) => setStockInForm({ ...stockInForm, batchNumber: e.target.value })}
                  className="input" placeholder="Optional" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowStockInModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-semibold">Cancel</button>
              <button onClick={handleStockIn} className="flex-1 bg-amber-500 hover:bg-amber-600 text-black rounded-xl py-2 text-sm font-semibold">Add Stock</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock-Out Modal */}
      {showStockOutModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Stock Out / Wastage</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Ingredient *</label>
                <select
                  value={stockOutForm.ingredientId}
                  onChange={(e) => setStockOutForm({ ...stockOutForm, ingredientId: e.target.value })}
                  className="input"
                >
                  <option value="">Select ingredient</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Quantity *</label>
                  <input type="number" min="0.001" step="0.001" value={stockOutForm.quantity}
                    onChange={(e) => setStockOutForm({ ...stockOutForm, quantity: e.target.value })}
                    className="input" placeholder="0.000" />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select
                    value={stockOutForm.type}
                    onChange={(e) => setStockOutForm({ ...stockOutForm, type: e.target.value })}
                    className="input"
                  >
                    <option value="WASTAGE">Wastage</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Reason</label>
                <input type="text" value={stockOutForm.reason}
                  onChange={(e) => setStockOutForm({ ...stockOutForm, reason: e.target.value })}
                  className="input" placeholder="e.g. Spoiled, Staff meal" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowStockOutModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-semibold">Cancel</button>
              <button onClick={handleStockOut} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2 text-sm font-semibold">Deduct Stock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
