import React, { useEffect, useState } from 'react';
import { purchaseOrderApi, supplierApi, ingredientApi } from '../../lib/api';
import toast from 'react-hot-toast';

interface PurchaseOrder {
  id: string;
  supplierId: string;
  status: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  supplier: { id: string; name: string; phone: string | null };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-slate-100 text-slate-600',
  SENT:      'bg-blue-50 text-blue-700 border-blue-200',
  RECEIVED:  'bg-green-50 text-green-700 border-green-200',
  CANCELLED: 'bg-red-50 text-red-600 border-red-200',
};

export default function PurchaseOrdersPage() {
  const [orders, setOrders]           = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers]     = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showNewModal, setShowNewModal]       = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);

  const [newForm, setNewForm] = useState({ supplierId: '', totalAmount: '', notes: '' });
  const [receiveItems, setReceiveItems] = useState<{
    ingredientId: string; quantity: string; costPerUnit: string;
    purchaseDate: string; expiryDate: string; batchNumber: string;
  }[]>([{
    ingredientId: '', quantity: '', costPerUnit: '',
    purchaseDate: new Date().toISOString().split('T')[0], expiryDate: '', batchNumber: '',
  }]);

  const load = async () => {
    setLoading(true);
    try {
      const [pos, sups, ings] = await Promise.all([
        purchaseOrderApi.list(),
        supplierApi.list(),
        ingredientApi.list(),
      ]);
      setOrders(pos.data);
      setSuppliers(sups.data);
      setIngredients(ings.data);
    } catch {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newForm.supplierId) { toast.error('Supplier required'); return; }
    try {
      await purchaseOrderApi.create({
        supplierId:  newForm.supplierId,
        totalAmount: newForm.totalAmount ? parseFloat(newForm.totalAmount) : 0,
        notes:       newForm.notes || undefined,
      });
      toast.success('Purchase order created');
      setShowNewModal(false);
      load();
    } catch {
      toast.error('Failed to create purchase order');
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    if (status === 'CANCELLED' && !confirm('Cancel this purchase order?')) return;
    try {
      if (status === 'CANCELLED') {
        await purchaseOrderApi.cancel(id);
      } else {
        await purchaseOrderApi.update(id, { status });
      }
      toast.success(`Order marked as ${status}`);
      load();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const openReceiveModal = (po: PurchaseOrder) => {
    setReceivingPO(po);
    setReceiveItems([{
      ingredientId: '', quantity: '', costPerUnit: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      expiryDate: '', batchNumber: '',
    }]);
    setShowReceiveModal(true);
  };

  const addReceiveRow = () => setReceiveItems([...receiveItems, {
    ingredientId: '', quantity: '', costPerUnit: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    expiryDate: '', batchNumber: '',
  }]);

  const updateReceiveRow = (i: number, field: string, val: string) => {
    const updated = [...receiveItems];
    (updated[i] as any)[field] = val;
    setReceiveItems(updated);
  };

  const handleReceive = async () => {
    if (!receivingPO) return;
    const valid = receiveItems.filter((r) => r.ingredientId && r.quantity && r.costPerUnit);
    if (valid.length === 0) { toast.error('Add at least one item to receive'); return; }

    try {
      await purchaseOrderApi.receive(
        receivingPO.id,
        valid.map((r) => ({
          ingredientId: r.ingredientId,
          quantity:     parseFloat(r.quantity),
          costPerUnit:  parseFloat(r.costPerUnit),
          purchaseDate: r.purchaseDate,
          expiryDate:   r.expiryDate || undefined,
          batchNumber:  r.batchNumber || undefined,
        })),
      );
      toast.success('Purchase order received — stock updated!');
      setShowReceiveModal(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to receive order');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-sm text-slate-500 mt-1">Track supplier orders and receive stock</p>
        </div>
        <button
          onClick={() => { setNewForm({ supplierId: '', totalAmount: '', notes: '' }); setShowNewModal(true); }}
          className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-4 py-2 rounded-xl text-sm"
        >
          + New PO
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="text-center py-16 text-slate-400">No purchase orders yet</div>
          ) : orders.map((po) => (
            <div key={po.id} className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-slate-800">{po.supplier?.name ?? '—'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[po.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {po.status}
                    </span>
                  </div>
                  {po.supplier?.phone && (
                    <div className="text-xs text-slate-500">{po.supplier.phone}</div>
                  )}
                  {po.notes && (
                    <div className="text-xs text-slate-400 mt-1 italic">{po.notes}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-800">
                    ₹{Number(po.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {new Date(po.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {po.status !== 'RECEIVED' && po.status !== 'CANCELLED' && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50">
                  {po.status === 'DRAFT' && (
                    <button
                      onClick={() => handleUpdateStatus(po.id, 'SENT')}
                      className="text-xs border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg font-semibold"
                    >
                      Mark as Sent
                    </button>
                  )}
                  <button
                    onClick={() => openReceiveModal(po)}
                    className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-semibold"
                  >
                    ✓ Receive & Add Stock
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(po.id, 'CANCELLED')}
                    className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New PO Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">New Purchase Order</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Supplier *</label>
                <select value={newForm.supplierId}
                  onChange={(e) => setNewForm({ ...newForm, supplierId: e.target.value })}
                  className="input">
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Estimated Amount (₹)</label>
                <input type="number" min="0" value={newForm.totalAmount}
                  onChange={(e) => setNewForm({ ...newForm, totalAmount: e.target.value })}
                  className="input" placeholder="0.00" />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea value={newForm.notes}
                  onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
                  className="input resize-none" rows={2} placeholder="Items needed, special instructions..." />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNewModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-semibold">Cancel</button>
              <button onClick={handleCreate} className="flex-1 bg-amber-500 hover:bg-amber-600 text-black rounded-xl py-2 text-sm font-semibold">Create PO</button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && receivingPO && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 my-4">
            <h2 className="text-lg font-bold mb-1">Receive Order</h2>
            <p className="text-sm text-slate-500 mb-4">
              From: <strong>{receivingPO.supplier?.name}</strong> — Stock will be updated automatically
            </p>

            <div className="space-y-3">
              {receiveItems.map((row, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Ingredient *</label>
                      <select value={row.ingredientId}
                        onChange={(e) => updateReceiveRow(i, 'ingredientId', e.target.value)}
                        className="input text-xs">
                        <option value="">Select</option>
                        {ingredients.map((ing: any) => (
                          <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Batch #</label>
                      <input type="text" value={row.batchNumber}
                        onChange={(e) => updateReceiveRow(i, 'batchNumber', e.target.value)}
                        className="input text-xs" placeholder="Optional" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="label">Quantity *</label>
                      <input type="number" min="0.001" step="0.001" value={row.quantity}
                        onChange={(e) => updateReceiveRow(i, 'quantity', e.target.value)}
                        className="input text-xs" placeholder="0.000" />
                    </div>
                    <div>
                      <label className="label">Cost/Unit (₹) *</label>
                      <input type="number" min="0" step="0.01" value={row.costPerUnit}
                        onChange={(e) => updateReceiveRow(i, 'costPerUnit', e.target.value)}
                        className="input text-xs" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="label">Expiry Date</label>
                      <input type="date" value={row.expiryDate}
                        onChange={(e) => updateReceiveRow(i, 'expiryDate', e.target.value)}
                        className="input text-xs" />
                    </div>
                  </div>
                  {receiveItems.length > 1 && (
                    <button onClick={() => setReceiveItems(receiveItems.filter((_, idx) => idx !== i))}
                      className="text-xs text-red-400 hover:text-red-600">Remove row</button>
                  )}
                </div>
              ))}
              <button onClick={addReceiveRow}
                className="text-sm text-amber-600 font-semibold">+ Add Item</button>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowReceiveModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-semibold">Cancel</button>
              <button onClick={handleReceive} className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl py-2 text-sm font-semibold">
                Confirm Receipt & Update Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
