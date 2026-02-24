import { useState, useEffect, useCallback } from 'react';
import { multiOutletApi } from '../../lib/api';

// ── Branch selector helper (fetches branches via restaurant context)
// We re-use the existing /branches API

import axios from 'axios';

const branchesApi = {
  list: () => axios.get(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'}/branches`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
  }),
};

export default function BranchMenuOverridePage() {
  const [branches,       setBranches]       = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [menu,           setMenu]           = useState<any[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [saving,         setSaving]         = useState<string | null>(null);
  const [search,         setSearch]         = useState('');

  // Push modal
  const [showPush,       setShowPush]       = useState(false);
  const [pushBranches,   setPushBranches]   = useState<string[]>([]);
  const [pushing,        setPushing]        = useState(false);
  const [pushResult,     setPushResult]     = useState<string | null>(null);

  useEffect(() => {
    branchesApi.list()
      .then((r) => {
        const list = r.data?.data ?? r.data ?? [];
        setBranches(list);
        if (list.length > 0) setSelectedBranch(list[0].id);
      })
      .catch(() => {});
  }, []);

  const loadMenu = useCallback(async () => {
    if (!selectedBranch) return;
    setLoading(true);
    try {
      const r = await multiOutletApi.getBranchMenu(selectedBranch);
      setMenu(r.data);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => { loadMenu(); }, [loadMenu]);

  async function toggleAvailability(item: any) {
    setSaving(item.id);
    try {
      await multiOutletApi.upsertOverride(selectedBranch, {
        menuItemId:  item.id,
        isAvailable: !item.branchAvailable,
        priceOverride: item.priceOverride ?? undefined,
      });
      await loadMenu();
    } finally {
      setSaving(null);
    }
  }

  async function updatePrice(item: any, price: string) {
    const num = parseFloat(price);
    if (isNaN(num) || num <= 0) return;
    setSaving(item.id);
    try {
      await multiOutletApi.upsertOverride(selectedBranch, {
        menuItemId:    item.id,
        isAvailable:   item.branchAvailable,
        priceOverride: num,
      });
      await loadMenu();
    } finally {
      setSaving(null);
    }
  }

  async function resetOverride(item: any) {
    setSaving(item.id);
    try {
      await multiOutletApi.deleteOverride(selectedBranch, item.id);
      await loadMenu();
    } finally {
      setSaving(null);
    }
  }

  async function handlePush() {
    if (!pushBranches.length) return;
    setPushing(true);
    try {
      const r = await multiOutletApi.pushMenu(pushBranches);
      setPushResult(r.data.message);
      setTimeout(() => { setShowPush(false); setPushResult(null); setPushBranches([]); }, 2000);
    } finally {
      setPushing(false);
    }
  }

  const filtered = menu.filter((m) =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.categoryName?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const grouped = filtered.reduce((acc: any, item: any) => {
    const cat = item.categoryName ?? 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6 anim-fade-up">

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-800">Branch Menu Overrides</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Set branch-specific availability and price overrides
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowPush(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Push Menu to Branches
          </button>
        </div>
      </div>

      {/* Branch selector + search */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="label">Branch</label>
          <select
            className="input w-48 text-sm"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="label">Search items</label>
          <input className="input text-sm" placeholder="Item name or category…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-400" /> Available
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-rose-400" /> Hidden at this branch
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" /> Has price override
        </div>
      </div>

      {/* Menu items grouped by category */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="flex gap-2">
            {[0,1,2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-bounce"
                style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-12">No items found.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, catItems]: [string, any]) => (
            <div key={category} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-700">{category}</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400">Item</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400">Base Price</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400">Branch Price</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-slate-400">Available</th>
                    <th className="w-20 px-4 py-2 text-xs font-semibold text-slate-400 text-center">Reset</th>
                  </tr>
                </thead>
                <tbody>
                  {catItems.map((item: any) => (
                    <tr key={item.id} className={`border-b border-slate-50 ${!item.branchAvailable ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {item.priceOverride && (
                            <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                          )}
                          <span className="text-slate-700 font-medium">{item.name}</span>
                          {saving === item.id && (
                            <span className="text-xs text-slate-400 animate-pulse">saving…</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-500">₹{item.basePrice.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number"
                          className="input text-xs py-1 w-24 text-right"
                          defaultValue={item.priceOverride ?? item.basePrice}
                          key={`${item.id}-${item.priceOverride}`}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (parseFloat(val) !== item.basePrice || item.priceOverride) {
                              updatePrice(item, val);
                            }
                          }}
                          disabled={saving === item.id}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => toggleAvailability(item)}
                          disabled={saving === item.id}
                          className={`w-8 h-5 rounded-full transition-colors relative flex-shrink-0 ${
                            item.branchAvailable ? 'bg-emerald-400' : 'bg-slate-300'
                          }`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            item.branchAvailable ? 'translate-x-3.5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {item.hasOverride && (
                          <button
                            onClick={() => resetOverride(item)}
                            disabled={saving === item.id}
                            className="text-xs text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            Reset
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Push Menu Modal */}
      {showPush && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md anim-scale-in">
            <h2 className="text-lg font-bold font-display text-slate-800 mb-2">Push Central Menu</h2>
            <p className="text-sm text-slate-500 mb-4">
              Mark all menu items as available at selected branches (resets branch overrides to available).
            </p>
            <div className="space-y-2 max-h-52 overflow-y-auto mb-4">
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pushBranches.includes(b.id)}
                    onChange={(e) => {
                      setPushBranches(e.target.checked
                        ? [...pushBranches, b.id]
                        : pushBranches.filter((id) => id !== b.id));
                    }}
                    className="w-4 h-4 accent-red-500"
                  />
                  <span className="text-sm font-medium text-slate-700">{b.name}</span>
                </label>
              ))}
            </div>
            {pushResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-sm text-emerald-700">
                {pushResult}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setShowPush(false); setPushBranches([]); setPushResult(null); }}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600">Cancel</button>
              <button onClick={handlePush} disabled={!pushBranches.length || pushing}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {pushing ? 'Pushing…' : `Push to ${pushBranches.length} branch${pushBranches.length !== 1 ? 'es' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
