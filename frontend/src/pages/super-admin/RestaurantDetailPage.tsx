import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { saApi } from './useSuperAdmin';

const MODE_LABELS: Record<string, string> = {
  COUNTER: 'Counter', TABLE_SIMPLE: 'Table Simple', FULL_SERVICE: 'Full Service',
};

function Stat({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-xl font-bold text-white mt-1" style={{ fontFamily: "'Syne', sans-serif" }}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    saApi().get(`/super-admin/restaurants/${id}`)
      .then((r) => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const doAction = async (action: 'suspend' | 'activate' | 'delete') => {
    if (action === 'delete' && !confirm('Delete this restaurant permanently?')) return;
    setActionLoading(action);
    try {
      const api = saApi();
      if (action === 'suspend') await api.patch(`/super-admin/restaurants/${id}/suspend`);
      else if (action === 'activate') await api.patch(`/super-admin/restaurants/${id}/activate`);
      else { await api.delete(`/super-admin/restaurants/${id}`); navigate('/super-admin/restaurants'); return; }
      const r = await api.get(`/super-admin/restaurants/${id}`);
      setData(r.data);
    } catch (e: any) { alert(e.response?.data?.userMessage ?? 'Action failed'); }
    finally { setActionLoading(''); }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="flex gap-2">{[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i*120}ms` }} />)}</div></div>;
  if (!data) return <div className="p-6 text-slate-400">Restaurant not found.</div>;

  const { restaurant, stats } = data;
  const r = restaurant ?? data;
  const s = stats ?? {};

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/super-admin/restaurants" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors mt-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-violet-700 flex items-center justify-center font-bold text-white text-lg flex-shrink-0" style={{ fontFamily: "'Syne', sans-serif" }}>
              {r.name?.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>{r.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {r.status}
                </span>
                {r.operatingMode && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400">
                    {MODE_LABELS[r.operatingMode] ?? r.operatingMode}
                  </span>
                )}
                {r.city && <span className="text-slate-500 text-xs">{r.city}</span>}
              </div>
            </div>
          </div>
        </div>
        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          {r.status === 'ACTIVE' ? (
            <button onClick={() => doAction('suspend')} disabled={!!actionLoading}
              className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-sm font-medium transition-colors disabled:opacity-50">
              {actionLoading === 'suspend' ? 'Suspending...' : 'Suspend'}
            </button>
          ) : r.status === 'SUSPENDED' ? (
            <button onClick={() => doAction('activate')} disabled={!!actionLoading}
              className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-sm font-medium transition-colors disabled:opacity-50">
              {actionLoading === 'activate' ? 'Activating...' : 'Activate'}
            </button>
          ) : null}
          <button onClick={() => doAction('delete')} disabled={!!actionLoading}
            className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 text-sm font-medium transition-colors disabled:opacity-50">
            Delete
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total Orders" value={s.totalOrders?.toLocaleString() ?? '—'} />
        <Stat label="Today's Orders" value={s.todayOrders ?? '—'} />
        <Stat label="Total Branches" value={s.totalBranches ?? '—'} />
        <Stat label="Total Staff" value={s.totalStaff ?? '—'} />
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Restaurant Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>Restaurant Info</h2>
          {[
            { label: 'Email', value: r.email },
            { label: 'Phone', value: r.phone },
            { label: 'Address', value: r.address },
            { label: 'City', value: r.city },
            { label: 'GSTIN', value: r.gstin },
            { label: 'FSSAI', value: r.fssaiNumber },
            { label: 'Timezone', value: r.timezone },
            { label: 'Business Day Cutoff', value: r.businessDayCutoff },
            { label: 'Created', value: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4 py-2 border-b border-slate-800/50 last:border-0">
              <span className="text-slate-500 text-xs flex-shrink-0">{label}</span>
              <span className="text-slate-300 text-xs text-right">{value || '—'}</span>
            </div>
          ))}
        </div>

        {/* Plan & Compliance */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>Plan & Compliance</h2>
            {[
              { label: 'Plan', value: r.plan?.name ?? 'No Plan' },
              { label: 'Plan Expires', value: r.planExpiresAt ? new Date(r.planExpiresAt).toLocaleDateString('en-IN') : 'N/A' },
              { label: 'DPDPA Consent', value: r.dpdpaConsentGiven ? 'Given' : 'Not given' },
              { label: 'Tax Inclusive', value: r.taxInclusive ? 'Yes' : 'No' },
              { label: 'Loyalty Points / ₹100', value: r.loyaltyPointsPerHundred },
              { label: 'Menu Version', value: r.menuVersion },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-4 py-2 border-b border-slate-800/50 last:border-0">
                <span className="text-slate-500 text-xs flex-shrink-0">{label}</span>
                <span className="text-slate-300 text-xs text-right">{String(value ?? '—')}</span>
              </div>
            ))}
          </div>

          {/* Suspended banner */}
          {r.status === 'SUSPENDED' && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex gap-3">
              <span className="text-lg">🚫</span>
              <div>
                <p className="text-sm font-semibold text-rose-400">Account Suspended</p>
                <p className="text-xs text-slate-400 mt-1">All logins are blocked for this restaurant. Click Activate to restore access.</p>
              </div>
            </div>
          )}

          {/* FSSAI warning */}
          {!r.fssaiNumber && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-400">FSSAI Not Set</p>
                <p className="text-xs text-slate-400 mt-1">The restaurant owner hasn't entered their FSSAI license number yet.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
