import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerApi } from '../../lib/api';
import { SearchIcon, UsersIcon } from '../../components/ui/Icons';

// ── Segment badge ─────────────────────────────────────────────────────────────

function SegBadge({ tags }: { tags?: string | null }) {
  if (!tags) return null;
  const tag = tags.includes('VIP') ? 'VIP'
    : tags.includes('REGULAR') ? 'REGULAR'
    : tags.includes('CORPORATE') ? 'CORP'
    : null;
  if (!tag) return null;
  const colors = {
    VIP:     'bg-amber-100 text-amber-700',
    REGULAR: 'bg-blue-100 text-blue-700',
    CORP:    'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[tag as keyof typeof colors]}`}>
      {tag}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [meta,      setMeta]      = useState({ total: 0, page: 1, pages: 1, limit: 30 });
  const [segments,  setSegments]  = useState<any>(null);
  const [search,    setSearch]    = useState('');
  const [tag,       setTag]       = useState('');
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(false);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ phone: '', name: '', email: '', tags: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    customerApi.segments().then((r) => setSegments(r.data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await customerApi.list({ search: search || undefined, tag: tag || undefined, page, limit: 30 });
      setCustomers(r.data.data);
      setMeta(r.data.meta);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [search, tag, page]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.phone) return;
    setSaving(true);
    try {
      await customerApi.create(form);
      setShowCreate(false);
      setForm({ phone: '', name: '', email: '', tags: '', notes: '' });
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6 anim-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-800">Customer Directory</h1>
          <p className="text-sm text-slate-500 mt-0.5">{meta.total.toLocaleString()} customers</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + Add Customer
        </button>
      </div>

      {/* Segment cards */}
      {segments && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total',     value: segments.total,        color: 'slate' },
            { label: 'VIP',       value: segments.vip,          color: 'amber' },
            { label: 'Regulars',  value: segments.regular,      color: 'blue'  },
            { label: 'New',       value: segments.newCustomers, color: 'green' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-bold font-display text-slate-800 mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 text-sm" placeholder="Search name, phone, email…"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-40 text-sm"
          value={tag} onChange={(e) => { setTag(e.target.value); setPage(1); }}
        >
          <option value="">All segments</option>
          <option value="VIP">VIP</option>
          <option value="REGULAR">Regular</option>
          <option value="CORPORATE">Corporate</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="flex gap-2">
              {[0,1,2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-bounce"
                  style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <UsersIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No customers found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Phone</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Orders</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Total Spend</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Credit Bal.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Points</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Segment</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/crm/customers/${c.id}`)}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{c.name ?? '—'}</p>
                    {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.phone}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{c.totalOrders}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    ₹{Number(c.totalSpend).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.creditBalance != null
                      ? <span className={`font-semibold ${c.creditBalance > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          ₹{c.creditBalance.toFixed(2)}
                        </span>
                      : <span className="text-slate-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right text-red-600 font-semibold">
                    {c.totalLoyaltyPoints > 0 ? c.totalLoyaltyPoints : '—'}
                  </td>
                  <td className="px-4 py-3"><SegBadge tags={c.tags} /></td>
                  <td className="px-4 py-3 text-slate-400">›</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Page {meta.page} of {meta.pages}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 text-sm rounded-xl border border-slate-200 disabled:opacity-40 hover:border-red-400 transition-colors">
              ← Prev
            </button>
            <button disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 text-sm rounded-xl border border-slate-200 disabled:opacity-40 hover:border-red-400 transition-colors">
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md anim-scale-in">
            <h2 className="text-lg font-bold font-display text-slate-800 mb-4">Add Customer</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Phone *</label>
                <input className="input" placeholder="10-digit phone"
                  value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Name</label>
                <input className="input" placeholder="Customer name"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="email@example.com"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Segment</label>
                <select className="input"
                  value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}>
                  <option value="">—</option>
                  <option value="VIP">VIP</option>
                  <option value="REGULAR">Regular</option>
                  <option value="CORPORATE">Corporate</option>
                </select>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} placeholder="Any notes…"
                  value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={!form.phone || saving}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
