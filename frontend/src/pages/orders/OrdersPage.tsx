import React, { useEffect, useState } from 'react';
import { orderApi, billApi, tableApi, categoryApi, menuApi, complaintsApi } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import {
  PlusIcon, SearchIcon, RefreshIcon, ClockIcon, CheckIcon, TableIcon, MinusIcon,
  AlertIcon,
} from '../../components/ui/Icons';

interface Order {
  id: string;
  orderType: string;
  status: string;
  tokenNumber: number | null;
  customerName: string | null;
  subtotal: number;
  grandTotal: number;
  createdAt: string;
  table?: { number: string; section: string | null } | null;
  items: { id: string; itemName: string; quantity: number; status: string }[];
  bills: { id: string; status: string; grandTotal: number }[];
}

const STATUS_STYLES: Record<string, string> = {
  NEW: 'bg-sky-100 text-sky-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-amber-100 text-amber-700',
  READY: 'bg-emerald-100 text-emerald-700',
  SERVED: 'bg-teal-100 text-teal-700',
  BILLED: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-rose-100 text-rose-600',
};

const TYPE_LABELS: Record<string, string> = {
  DINE_IN: 'Dine In',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
  COMPLIMENTARY: 'Complimentary',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await orderApi.getAll({ status: statusFilter || undefined, limit: 100 });
      setOrders(res.data.orders ?? res.data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [statusFilter]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    return (
      !q ||
      o.table?.number.toLowerCase().includes(q) ||
      o.customerName?.toLowerCase().includes(q) ||
      o.tokenNumber?.toString().includes(q)
    );
  });

  const activeStatuses = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'BILLED'];
  const activeOrders = filtered.filter((o) => activeStatuses.includes(o.status));
  const completedOrders = filtered.filter((o) => !activeStatuses.includes(o.status));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 anim-fade-up">
        <div>
          <h1 className="font-display font-bold text-slate-900 text-2xl">Orders</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {activeOrders.length} active · {completedOrders.length} completed today
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchOrders}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <RefreshIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-display text-white hover:brightness-95"
            style={{ background: 'var(--accent)' }}
          >
            <PlusIcon className="w-4 h-4" /> New Order
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 anim-fade-up delay-50">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search table, token, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white w-64"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['', 'NEW', 'PREPARING', 'READY', 'BILLED', 'COMPLETED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-display transition-colors ${
                statusFilter === s
                  ? 'bg-red-500 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <ClockIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-400 font-display text-sm">No orders found</p>
        </div>
      ) : (
        <>
          {/* Active orders */}
          {activeOrders.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-400 font-display uppercase tracking-wide mb-3">Active Orders</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeOrders.map((order, i) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    index={i}
                    onClick={() => setSelectedOrder(order)}
                    onRefresh={fetchOrders}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed/Cancelled */}
          {completedOrders.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 font-display uppercase tracking-wide mb-3">Completed</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
                {completedOrders.slice(0, 9).map((order, i) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    index={i}
                    onClick={() => setSelectedOrder(order)}
                    onRefresh={fetchOrders}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* New Order Modal */}
      <NewOrderModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={(newOrder) => {
          setOrders((prev) => [newOrder, ...prev]);
          setSelectedOrder(newOrder);
          setShowNewModal(false);
        }}
      />

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          orderId={selectedOrder.id}
          onClose={() => { setSelectedOrder(null); fetchOrders(); }}
        />
      )}
    </div>
  );
}

// ─── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  index,
  onClick,
  onRefresh,
}: {
  order: Order;
  index: number;
  onClick: () => void;
  onRefresh: () => void;
}) {
  const elapsed = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-slate-200 transition-all anim-fade-up"
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {order.tokenNumber && (
              <span className="font-display font-bold text-red-600 text-lg">#{order.tokenNumber}</span>
            )}
            {order.table && (
              <span className="font-display font-semibold text-slate-800">
                Table {order.table.number}
              </span>
            )}
            {!order.tokenNumber && !order.table && (
              <span className="font-display font-semibold text-slate-800">
                {order.customerName ?? 'Walk-in'}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">{TYPE_LABELS[order.orderType] ?? order.orderType}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold font-display ${STATUS_STYLES[order.status] ?? 'bg-slate-100 text-slate-600'}`}>
          {order.status}
        </span>
      </div>

      <div className="space-y-1 mb-3">
        {order.items.slice(0, 3).map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-slate-600 truncate">{item.itemName}</span>
            <span className="text-slate-400 ml-2 flex-shrink-0">×{item.quantity}</span>
          </div>
        ))}
        {order.items.length > 3 && (
          <p className="text-xs text-slate-400">+{order.items.length - 3} more items</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-50">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <ClockIcon className="w-3 h-3" />
          <span>{elapsed < 1 ? 'Just now' : `${elapsed}m ago`}</span>
        </div>
        <span className="font-display font-bold text-slate-800 text-sm">
          ₹{Number(order.grandTotal || 0).toFixed(2)}
        </span>
      </div>
    </div>
  );
}

// ─── New Order Modal ───────────────────────────────────────────────────────────

function NewOrderModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (order: Order) => void;
}) {
  const [form, setForm] = useState({
    type: 'DINE_IN',
    tableId: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tables, setTables] = useState<Array<{ id: string; number: string; capacity: number; status: string }>>([]);
  const [loadingTables, setLoadingTables] = useState(false);

  useEffect(() => {
    if (open && form.type === 'DINE_IN') {
      setLoadingTables(true);
      tableApi.getAll()
        .then((res) => setTables(res.data ?? []))
        .catch(() => setTables([]))
        .finally(() => setLoadingTables(false));
    }
  }, [open, form.type]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await orderApi.create({
        type: form.type,
        tableId: form.tableId || undefined,
        customerName: form.customerName || undefined,
        customerPhone: form.customerPhone || undefined,
        customerAddress: form.type === 'DELIVERY' ? form.customerAddress || undefined : undefined,
        notes: form.notes || undefined,
      });
      onCreated(res.data);
    } catch (err: any) {
      setError(err.response?.data?.userMessage ?? 'Failed to create order');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Order"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:brightness-95"
            style={{ background: 'var(--accent)' }}
          >
            {saving ? 'Creating...' : 'Create Order'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2 font-display">Order Type</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'DINE_IN', label: '🍽️ Dine In' },
              { value: 'TAKEAWAY', label: '📦 Takeaway' },
              { value: 'DELIVERY', label: '🛵 Delivery' },
              { value: 'COMPLIMENTARY', label: '🎁 Complimentary' },
            ].map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => set('type', t.value)}
                className={`p-3 rounded-xl text-sm font-semibold font-display border-2 transition-all text-left ${
                  form.type === t.value
                    ? 'border-red-500 bg-amber-50 text-amber-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {form.type === 'DINE_IN' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">
              <div className="flex items-center gap-2">
                <TableIcon className="w-4 h-4" />
                <span>Table (optional)</span>
              </div>
            </label>
            {loadingTables ? (
              <div className="skeleton h-12 rounded-xl" />
            ) : (
              <select
                value={form.tableId}
                onChange={(e) => set('tableId', e.target.value)}
                className={inputClass}
              >
                <option value="">No table (counter service)</option>
                {tables
                  .filter((t) => t.status === 'AVAILABLE')
                  .sort((a, b) => Number(a.number) - Number(b.number) || a.number.localeCompare(b.number))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.number} ({t.capacity} {t.capacity === 1 ? 'seat' : 'seats'})
                    </option>
                  ))}
              </select>
            )}
            {!loadingTables && tables.length === 0 && (
              <p className="text-xs text-slate-400 mt-1.5">No tables available. Create tables in the Tables section.</p>
            )}
            {!loadingTables && tables.filter((t) => t.status === 'AVAILABLE').length === 0 && tables.length > 0 && (
              <p className="text-xs text-red-600 mt-1.5">All tables are currently occupied.</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Customer Name</label>
            <input type="text" value={form.customerName} onChange={(e) => set('customerName', e.target.value)} placeholder="Optional" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Phone</label>
            <input type="tel" value={form.customerPhone} onChange={(e) => set('customerPhone', e.target.value)} placeholder="+91..." className={inputClass} />
          </div>
        </div>

        {form.type === 'DELIVERY' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Delivery Address</label>
            <input type="text" value={form.customerAddress} onChange={(e) => set('customerAddress', e.target.value)} placeholder="Full delivery address" className={inputClass} />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Notes</label>
          <input type="text" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Any special instructions..." className={inputClass} />
        </div>

        {error && <p className="text-rose-500 text-sm">{error}</p>}
      </div>
    </Modal>
  );
}

// ─── Order Detail Modal ────────────────────────────────────────────────────────

function OrderDetailModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});

  // ── Complaint state ────────────────────────────────────────────────────────
  const [complaintItem, setComplaintItem] = useState<{ id: string; name: string } | null>(null);
  const [complaintReason, setComplaintReason] = useState('QUALITY');
  const [complaintNotes, setComplaintNotes] = useState('');
  const [filingComplaint, setFilingComplaint] = useState(false);

  const COMPLAINT_REASONS = [
    { value: 'QUALITY',        label: 'Poor Quality (rubbery, overcooked…)' },
    { value: 'WRONG_ITEM',     label: 'Wrong Item Served' },
    { value: 'COLD',           label: 'Served Cold' },
    { value: 'QUANTITY',       label: 'Portion Too Small' },
    { value: 'FOREIGN_OBJECT', label: 'Foreign Object Found' },
    { value: 'OTHER',          label: 'Other' },
  ];

  const handleFileComplaint = async () => {
    if (!complaintItem) return;
    setFilingComplaint(true);
    try {
      await complaintsApi.file(orderId, {
        orderItemId: complaintItem.id,
        reason:      complaintReason,
        notes:       complaintNotes || undefined,
      });
      setComplaintItem(null);
      setComplaintNotes('');
      setComplaintReason('QUALITY');
      await fetchOrder(); // refresh — item now VOIDED, total updated
    } catch { } finally {
      setFilingComplaint(false);
    }
  };

  // ── Item Picker state ──────────────────────────────────────────────────────
  const [showPicker, setShowPicker] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [addingItems, setAddingItems] = useState(false);

  const fetchOrder = async () => {
    try {
      const res = await orderApi.getOne(orderId);
      setOrder(res.data);
    } catch { } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrder(); }, [orderId]);

  const openPicker = async () => {
    setShowPicker(true);
    if (categories.length > 0) return;
    setLoadingMenu(true);
    try {
      const catRes = await categoryApi.getAll();
      const cats = catRes.data ?? [];
      setCategories(cats);
      const firstCatId = cats[0]?.id ?? '';
      setSelectedCat(firstCatId);
      const itemRes = await menuApi.getAll(firstCatId || undefined);
      setMenuItems(itemRes.data ?? []);
    } catch { } finally {
      setLoadingMenu(false);
    }
  };

  const switchCategory = async (catId: string) => {
    setSelectedCat(catId);
    setLoadingMenu(true);
    try {
      const res = await menuApi.getAll(catId || undefined);
      setMenuItems(res.data ?? []);
    } catch { } finally {
      setLoadingMenu(false);
    }
  };

  const adjustCart = (menuItemId: string, delta: number) => {
    setCart((prev) => {
      const next = { ...prev };
      const cur = next[menuItemId] ?? 0;
      const val = cur + delta;
      if (val <= 0) delete next[menuItemId];
      else next[menuItemId] = val;
      return next;
    });
  };

  const cartCount = Object.values(cart).reduce((s, n) => s + n, 0);

  const handleAddItems = async () => {
    if (cartCount === 0) return;
    setAddingItems(true);
    try {
      const items = Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
      await orderApi.addItems(orderId, items);
      setCart({});
      setShowPicker(false);
      await fetchOrder();
    } catch { } finally {
      setAddingItems(false);
    }
  };

  const handleSendKot = async () => {
    setActionLoading('kot');
    try {
      await orderApi.generateKot(orderId);
      await fetchOrder();
    } catch { } finally {
      setActionLoading('');
    }
  };

  const handleGenerateBill = async () => {
    setActionLoading('bill');
    try {
      await orderApi.generateBill(orderId, {});
      await fetchOrder();
    } catch { } finally {
      setActionLoading('');
    }
  };

  const handlePayCash = async () => {
    if (!order?.bills?.[0]) return;
    setActionLoading('pay');
    try {
      const bill = order.bills[order.bills.length - 1];
      await billApi.recordPayment(bill.id, [{ method: 'CASH', amount: Number(bill.grandTotal) }]);
      await fetchOrder();
    } catch { } finally {
      setActionLoading('');
    }
  };

  const pendingItems = order?.items?.filter((i: any) => i.status === 'PENDING' && !i.kotId) ?? [];
  const activeBill = order?.bills?.find((b: any) => ['UNPAID', 'PARTIALLY_PAID'].includes(b.status));
  const hasPaidBill = order?.bills?.some((b: any) => b.status === 'PAID');

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Order ${order?.table ? `- Table ${order.table.number}` : order?.tokenNumber ? `#${order.tokenNumber}` : ''}`}
      size="lg"
    >
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-10 rounded-xl" />)}
        </div>
      ) : order ? (
        <div className="space-y-5">
          {/* Status + type */}
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold font-display ${STATUS_STYLES[order.status] ?? ''}`}>
              {order.status}
            </span>
            <span className="text-sm text-slate-500">{TYPE_LABELS[order.orderType]}</span>
            {order.customerName && <span className="text-sm text-slate-500">· {order.customerName}</span>}
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-slate-400 font-display uppercase tracking-wide mb-2">Items</p>
            <div className="bg-slate-50 rounded-xl divide-y divide-slate-100">
              {order.items.length === 0 ? (
                <p className="p-4 text-sm text-slate-400 text-center">No items yet</p>
              ) : (
                order.items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className={`text-sm font-medium ${item.status === 'VOIDED' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {item.itemName}
                        {item.variantName && <span className="text-slate-400 ml-1">({item.variantName})</span>}
                        {' '}<span className="text-slate-400">×{item.quantity}</span>
                      </p>
                      {item.specialInstructions && (
                        <p className="text-xs text-slate-400 mt-0.5">{item.specialInstructions}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-700">
                        ₹{(Number(item.unitPrice) * item.quantity).toFixed(2)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-display ${
                        item.status === 'VOIDED' ? 'bg-rose-100 text-rose-600' :
                        item.status === 'READY' ? 'bg-emerald-100 text-emerald-700' :
                        item.kotId ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {item.status === 'VOIDED' ? 'Voided' : item.kotId ? item.status : 'Pending'}
                      </span>
                    </div>
                    {/* Complaint button — only for served/ready items not yet voided */}
                    {item.status !== 'VOIDED' && item.kotId && !['COMPLETED', 'CANCELLED', 'BILLED'].includes(order.status) && (
                      <button
                        onClick={() => { setComplaintItem({ id: item.id, name: item.itemName }); setComplaintReason('QUALITY'); setComplaintNotes(''); }}
                        title="Customer complaint — remove from bill"
                        className="ml-3 p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors flex-shrink-0"
                      >
                        <AlertIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add Items Picker */}
          {!['COMPLETED', 'CANCELLED', 'BILLED'].includes(order.status) && !hasPaidBill && (
            <div>
              {!showPicker ? (
                <button
                  onClick={openPicker}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold font-display text-slate-500 hover:border-red-500 hover:text-red-600 transition-colors"
                >
                  <PlusIcon className="w-4 h-4" /> Add Items
                </button>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  {/* Picker header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <p className="text-sm font-semibold font-display text-slate-700">Add Menu Items</p>
                    <button
                      onClick={() => { setShowPicker(false); setCart({}); }}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Category tabs */}
                  {categories.length > 0 && (
                    <div className="flex gap-1.5 p-3 border-b border-slate-100 overflow-x-auto">
                      <button
                        onClick={() => switchCategory('')}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold font-display transition-colors ${
                          selectedCat === '' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        All
                      </button>
                      {categories.map((cat: any) => (
                        <button
                          key={cat.id}
                          onClick={() => switchCategory(cat.id)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold font-display transition-colors ${
                            selectedCat === cat.id ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Items list */}
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                    {loadingMenu ? (
                      <div className="p-4 space-y-2">
                        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
                      </div>
                    ) : menuItems.filter((m: any) => m.isAvailable !== false).length === 0 ? (
                      <p className="p-4 text-sm text-slate-400 text-center">No items in this category</p>
                    ) : (
                      menuItems
                        .filter((m: any) => m.isAvailable !== false)
                        .map((item: any) => {
                          const qty = cart[item.id] ?? 0;
                          return (
                            <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                                <p className="text-xs text-slate-400">₹{Number(item.price).toFixed(2)}</p>
                              </div>
                              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                {qty > 0 ? (
                                  <>
                                    <button
                                      onClick={() => adjustCart(item.id, -1)}
                                      className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700"
                                    >
                                      <MinusIcon className="w-3 h-3" />
                                    </button>
                                    <span className="w-6 text-center text-sm font-semibold font-display text-slate-800">{qty}</span>
                                    <button
                                      onClick={() => adjustCart(item.id, 1)}
                                      className="w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 flex items-center justify-center text-white"
                                    >
                                      <PlusIcon className="w-3 h-3" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => adjustCart(item.id, 1)}
                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-500 hover:text-white flex items-center justify-center text-slate-500 transition-colors"
                                  >
                                    <PlusIcon className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>

                  {/* Add to Order footer */}
                  {cartCount > 0 && (
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                      <button
                        onClick={handleAddItems}
                        disabled={addingItems}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold font-display text-white hover:brightness-95 disabled:opacity-60 transition-all"
                        style={{ background: 'var(--accent)' }}
                      >
                        {addingItems ? 'Adding...' : `Add ${cartCount} item${cartCount > 1 ? 's' : ''} to Order`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* KOTs */}
          {order.kots?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 font-display uppercase tracking-wide mb-2">KOTs Sent</p>
              <div className="flex flex-wrap gap-2">
                {order.kots.map((kot: any) => (
                  <div key={kot.id} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-lg text-xs">
                    <CheckIcon className="w-3 h-3 text-red-600" />
                    <span className="font-mono text-amber-700">{kot.kotNumber}</span>
                    {kot.kitchenStation && <span className="text-amber-500">· {kot.kitchenStation}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          {activeBill && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{Number(activeBill.grandTotal - (activeBill.taxTotal ?? 0)).toFixed(2)}</span></div>
              {Number(activeBill.taxTotal ?? 0) > 0 && (
                <div className="flex justify-between text-slate-600"><span>Tax</span><span>₹{Number(activeBill.taxTotal).toFixed(2)}</span></div>
              )}
              <div className="flex justify-between font-bold text-slate-800 text-base pt-1.5 border-t border-slate-200 mt-1.5">
                <span>Total</span><span>₹{Number(activeBill.grandTotal).toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          {!hasPaidBill && !['COMPLETED', 'CANCELLED'].includes(order.status) && (
            <div className="flex flex-wrap gap-3 pt-2">
              {pendingItems.length > 0 && (
                <button
                  onClick={handleSendKot}
                  disabled={actionLoading === 'kot'}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold font-display text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-60"
                >
                  {actionLoading === 'kot' ? 'Sending...' : `Send to Kitchen (${pendingItems.length} items)`}
                </button>
              )}
              {!activeBill && order.items.some((i: any) => i.status !== 'VOIDED') && (
                <button
                  onClick={handleGenerateBill}
                  disabled={actionLoading === 'bill'}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold font-display text-white hover:brightness-95 disabled:opacity-60"
                  style={{ background: 'var(--accent)' }}
                >
                  {actionLoading === 'bill' ? 'Generating...' : 'Generate Bill'}
                </button>
              )}
              {activeBill && (
                <button
                  onClick={handlePayCash}
                  disabled={actionLoading === 'pay'}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold font-display text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
                >
                  {actionLoading === 'pay' ? 'Processing...' : `Pay ₹${Number(activeBill.grandTotal).toFixed(0)} (Cash)`}
                </button>
              )}
            </div>
          )}

          {hasPaidBill && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm font-display">
              <CheckIcon className="w-4 h-4" /> Order completed and paid
            </div>
          )}
        </div>
      ) : (
        <p className="text-slate-400 text-sm text-center py-10">Order not found</p>
      )}
    </Modal>

    {/* ── Complaint Modal ──────────────────────────────────────────────────── */}
    {complaintItem && (
      <Modal
        open={!!complaintItem}
        onClose={() => setComplaintItem(null)}
        title="File Customer Complaint"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setComplaintItem(null)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleFileComplaint}
              disabled={filingComplaint}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60"
            >
              {filingComplaint ? 'Filing…' : 'Remove from Bill & Log'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-rose-50 rounded-xl border border-rose-100">
            <AlertIcon className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-rose-800 font-display">{complaintItem.name}</p>
              <p className="text-xs text-rose-600 mt-0.5">
                This item will be removed from the bill and logged for quality review.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Reason for Complaint</label>
            <select
              value={complaintReason}
              onChange={(e) => setComplaintReason(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-display bg-white focus:outline-none focus:border-red-500"
            >
              {COMPLAINT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Additional Notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              value={complaintNotes}
              onChange={(e) => setComplaintNotes(e.target.value)}
              placeholder="e.g. Kabab was rubbery and hard, customer sent it back after first bite"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-display resize-none focus:outline-none focus:border-red-500"
            />
          </div>
        </div>
      </Modal>
    )}
  );
}
