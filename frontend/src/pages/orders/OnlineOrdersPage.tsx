import { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshIcon, SearchIcon } from '../../components/ui/Icons';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface AggOrder {
  id: string;
  platform: string;
  platformOrderId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  orderId?: string;
  rawPayload: any;
  branchId: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING:  { label: 'Pending',  className: 'bg-amber-100 text-amber-700' },
  ACCEPTED: { label: 'Accepted', className: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rejected', className: 'bg-rose-100 text-rose-600' },
};

const PLATFORM_CONFIG: Record<string, { label: string; className: string }> = {
  zomato: { label: 'Zomato', className: 'bg-red-100 text-red-700' },
  swiggy: { label: 'Swiggy', className: 'bg-orange-100 text-orange-700' },
};

export default function OnlineOrdersPage() {
  const [orders, setOrders]     = useState<AggOrder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [platform, setPlatform] = useState('');
  const [detail, setDetail]     = useState<AggOrder | null>(null);
  const [search, setSearch]     = useState('');

  useEffect(() => { load(); }, [platform]);

  function load() {
    setLoading(true);
    axios
      .get(`${API}/api/v1/integrations/aggregator/orders`, {
        params: platform ? { platform } : {},
      })
      .then((r) => setOrders(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  async function accept(id: string) {
    await axios.post(`${API}/api/v1/integrations/aggregator/orders/${id}/accept`, {});
    load();
  }

  async function reject(id: string) {
    await axios.post(`${API}/api/v1/integrations/aggregator/orders/${id}/reject`, { reason: 'Rejected by staff' });
    load();
  }

  const pending  = orders.filter((o) => o.status === 'PENDING');
  const accepted = orders.filter((o) => o.status === 'ACCEPTED');
  const rejected = orders.filter((o) => o.status === 'REJECTED');

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const customer = (o.rawPayload?.customer?.name ?? o.rawPayload?.customer_name ?? '').toLowerCase();
    return o.platformOrderId.toLowerCase().includes(q) || customer.includes(q);
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 anim-fade-up flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-slate-900 text-2xl">Online Orders</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage Zomato &amp; Swiggy orders from your dashboard.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Platform filter */}
          {(['', 'zomato', 'swiggy'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold font-display transition-colors border ${
                platform === p
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {p === '' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          <button
            onClick={load}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            <RefreshIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5 anim-fade-up delay-50">
        {[
          { label: 'Pending',  count: pending.length,  bg: 'bg-amber-50',   num: 'text-red-600',   border: 'border-amber-100' },
          { label: 'Accepted', count: accepted.length, bg: 'bg-emerald-50', num: 'text-emerald-600', border: 'border-emerald-100' },
          { label: 'Rejected', count: rejected.length, bg: 'bg-rose-50',    num: 'text-rose-600',    border: 'border-rose-100' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-5`}>
            <p className="text-xs font-semibold text-slate-500 font-display uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 font-display ${s.num}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Pending alert banner */}
      {pending.length > 0 && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 anim-fade-up">
          <span className="text-xl animate-pulse">🔔</span>
          <div>
            <p className="text-sm font-semibold text-amber-800 font-display">
              {pending.length} order{pending.length > 1 ? 's' : ''} waiting for confirmation
            </p>
            <p className="text-xs text-red-600 mt-0.5">Accept or reject each order within the SLA window.</p>
          </div>
        </div>
      )}

      {/* Search */}
      {orders.length > 0 && (
        <div className="relative mb-4">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by order ID or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm w-72 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-semibold font-display text-slate-700">No online orders yet.</p>
          <p className="text-sm text-slate-400 mt-1">Configure Zomato &amp; Swiggy webhooks in Integration Settings.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Platform</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Order ID</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Customer</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Items</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((o) => {
                const payload  = o.rawPayload ?? {};
                const customer = payload.customer?.name ?? payload.customer_name ?? '—';
                const items: any[] = payload.items ?? [];
                const plat = PLATFORM_CONFIG[o.platform] ?? { label: o.platform.toUpperCase(), className: 'bg-slate-100 text-slate-600' };
                const stat = STATUS_CONFIG[o.status];
                return (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${plat.className}`}>
                        {plat.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">{o.platformOrderId}</td>
                    <td className="px-5 py-3.5 text-slate-800 font-medium">{customer}</td>
                    <td className="px-5 py-3.5 text-slate-500 max-w-[180px] truncate">
                      {items.length > 0
                        ? items.slice(0, 2).map((i: any) => i.name ?? i.item_name).join(', ') +
                          (items.length > 2 ? ` +${items.length - 2}` : '')
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold font-display ${stat.className}`}>
                        {stat.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setDetail(o)}
                          className="text-xs text-slate-400 hover:text-slate-700 font-medium transition-colors"
                        >
                          View
                        </button>
                        {o.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => accept(o.id)}
                              className="text-xs text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1 rounded-lg font-semibold transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => reject(o.id)}
                              className="text-xs text-rose-600 hover:text-rose-700 font-medium transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white border-t border-slate-200 rounded-t-2xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-display">Order Detail</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{detail.platformOrderId}</p>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xl transition-colors"
              >
                ×
              </button>
            </div>
            <pre className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(detail.rawPayload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
