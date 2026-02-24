import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { saApi } from './useSuperAdmin';

const MODE_COLORS: Record<string, string> = {
  COUNTER: 'bg-blue-500/10 text-blue-400',
  TABLE_SIMPLE: 'bg-red-500/10 text-amber-400',
  FULL_SERVICE: 'bg-emerald-500/10 text-emerald-400',
};

export default function RestaurantsListPage() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const api = saApi();
      const params: any = { page, limit: LIMIT };
      if (search) params.search = search;
      if (status) params.status = status;
      if (mode) params.mode = mode;
      const res = await api.get('/super-admin/restaurants', { params });
      const data = res.data;
      if (Array.isArray(data)) {
        setRestaurants(data);
        setTotal(data.length);
      } else {
        setRestaurants(data.data ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, status, mode, page]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (id: string, action: 'suspend' | 'activate' | 'delete') => {
    setActionLoading(id + action);
    try {
      const api = saApi();
      if (action === 'suspend') await api.patch(`/super-admin/restaurants/${id}/suspend`);
      else if (action === 'activate') await api.patch(`/super-admin/restaurants/${id}/activate`);
      else if (action === 'delete') { if (!confirm('Delete this restaurant? This cannot be undone.')) return; await api.delete(`/super-admin/restaurants/${id}`); }
      await load();
    } catch (e: any) { alert(e.response?.data?.userMessage ?? 'Action failed'); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>Restaurants</h1>
          <p className="text-slate-400 text-sm mt-1">{total} total restaurants on the platform</p>
        </div>
        <Link
          to="/super-admin/restaurants/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Restaurant
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name, email, city..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DELETED">Deleted</option>
        </select>
        <select value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">All Modes</option>
          <option value="COUNTER">Counter</option>
          <option value="TABLE_SIMPLE">Table Simple</option>
          <option value="FULL_SERVICE">Full Service</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Restaurant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">City</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Mode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500">Loading...</td></tr>
              ) : restaurants.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500">No restaurants found</td></tr>
              ) : restaurants.map((r: any) => (
                <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-800 flex items-center justify-center text-xs font-bold text-violet-200 flex-shrink-0">
                        {r.name?.charAt(0)}
                      </div>
                      <div>
                        <Link to={`/super-admin/restaurants/${r.id}`} className="font-medium text-white hover:text-violet-400 transition-colors">
                          {r.name}
                        </Link>
                        <p className="text-xs text-slate-500">{r.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{r.city || '—'}</td>
                  <td className="px-4 py-3">
                    {r.operatingMode ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MODE_COLORS[r.operatingMode] ?? 'bg-slate-700 text-slate-400'}`}>
                        {r.operatingMode.replace('_', ' ')}
                      </span>
                    ) : <span className="text-slate-600 text-xs">Not set</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' :
                      r.status === 'SUSPENDED' ? 'bg-rose-500/10 text-rose-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {new Date(r.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/super-admin/restaurants/${r.id}`}
                        className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                        View
                      </Link>
                      {r.status === 'ACTIVE' ? (
                        <button
                          onClick={() => doAction(r.id, 'suspend')}
                          disabled={actionLoading === r.id + 'suspend'}
                          className="px-2.5 py-1 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50">
                          Suspend
                        </button>
                      ) : r.status === 'SUSPENDED' ? (
                        <button
                          onClick={() => doAction(r.id, 'activate')}
                          disabled={actionLoading === r.id + 'activate'}
                          className="px-2.5 py-1 rounded-lg text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50">
                          Activate
                        </button>
                      ) : null}
                      <button
                        onClick={() => doAction(r.id, 'delete')}
                        disabled={actionLoading === r.id + 'delete'}
                        className="px-2.5 py-1 rounded-lg text-xs text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <p className="text-xs text-slate-500">Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40 transition-colors">← Prev</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * LIMIT >= total}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40 transition-colors">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
