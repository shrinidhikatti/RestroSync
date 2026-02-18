import { useState, useEffect } from 'react';
import axios from 'axios';

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

const STATUS_STYLES: Record<string, string> = {
  PENDING:  'bg-amber-500/10 text-amber-400',
  ACCEPTED: 'bg-emerald-500/10 text-emerald-400',
  REJECTED: 'bg-rose-500/10 text-rose-400',
};

const PLATFORM_COLORS: Record<string, string> = {
  zomato: 'bg-red-600',
  swiggy: 'bg-orange-500',
};

export default function OnlineOrdersPage() {
  const [orders, setOrders]   = useState<AggOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('');
  const [detail, setDetail]   = useState<AggOrder | null>(null);

  useEffect(() => { load(); }, [platform]);

  function load() {
    setLoading(true);
    axios.get(`${API}/api/v1/integrations/aggregator/orders`, {
      params: platform ? { platform } : {},
    }).then((r) => setOrders(r.data ?? [])).catch(() => {}).finally(() => setLoading(false));
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Online Orders</h1>
          <p className="text-sm text-slate-400 mt-1">Manage Zomato &amp; Swiggy orders from your dashboard.</p>
        </div>
        <div className="flex items-center gap-2">
          {['', 'zomato', 'swiggy'].map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                platform === p ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              {p === '' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          <button onClick={load} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white text-sm transition-colors">
            ↻
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending',  count: pending.length,  color: 'text-amber-400' },
          { label: 'Accepted', count: accepted.length, color: 'text-emerald-400' },
          { label: 'Rejected', count: rejected.length, color: 'text-rose-400' },
        ].map((s) => (
          <div key={s.label} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 font-display ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Pending action banner */}
      {pending.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl animate-pulse">🔔</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-400">{pending.length} order{pending.length > 1 ? 's' : ''} waiting for confirmation</p>
            <p className="text-xs text-slate-400 mt-0.5">Accept or reject each order within the SLA window.</p>
          </div>
        </div>
      )}

      {/* Orders table */}
      {loading ? (
        <div className="text-center text-slate-500 py-16">Loading…</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-slate-500 py-16">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-medium">No online orders yet.</p>
          <p className="text-sm mt-1">Configure Zomato &amp; Swiggy webhooks in Integration Settings.</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                <th className="px-5 py-3 font-medium">Platform</th>
                <th className="px-5 py-3 font-medium">Order ID</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {orders.map((o) => {
                const payload = o.rawPayload ?? {};
                const customer = payload.customer?.name ?? payload.customer_name ?? '—';
                const items: any[] = payload.items ?? [];
                return (
                  <tr key={o.id} className="hover:bg-slate-700/20">
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold text-white ${PLATFORM_COLORS[o.platform] ?? 'bg-slate-600'}`}>
                        {o.platform.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-300 font-mono text-xs">{o.platformOrderId}</td>
                    <td className="px-5 py-3 text-white">{customer}</td>
                    <td className="px-5 py-3 text-slate-400">
                      {items.length > 0
                        ? items.slice(0, 2).map((i: any) => i.name ?? i.item_name).join(', ') + (items.length > 2 ? ` +${items.length - 2}` : '')
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[o.status]}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right space-x-2">
                      <button
                        onClick={() => setDetail(o)}
                        className="text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        View
                      </button>
                      {o.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => accept(o.id)}
                            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-semibold"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => reject(o.id)}
                            className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setDetail(null)}>
          <div
            className="bg-slate-800 border-t border-slate-700 rounded-t-2xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white font-display">Order Detail</h2>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <pre className="text-xs text-slate-300 bg-slate-900 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(detail.rawPayload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
