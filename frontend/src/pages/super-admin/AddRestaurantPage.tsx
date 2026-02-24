import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { saApi } from './useSuperAdmin';

const MODES = [
  { value: 'COUNTER',      label: 'Counter',      emoji: '🏪', desc: 'No tables, fast billing' },
  { value: 'TABLE_SIMPLE', label: 'Table Simple',  emoji: '🍽️', desc: 'Tables, no reservations' },
  { value: 'FULL_SERVICE', label: 'Full Service',  emoji: '🍾', desc: 'All features enabled' },
];

const MODULE_META = [
  { key: 'TABLES',        label: 'Tables',          desc: 'Table map & floor plan' },
  { key: 'RESERVATIONS',  label: 'Reservations',    desc: 'Advance booking system' },
  { key: 'KDS',           label: 'Kitchen Display', desc: 'KDS screen for kitchen' },
  { key: 'INVENTORY',     label: 'Inventory',       desc: 'Stock, recipes, purchase orders' },
  { key: 'CRM',           label: 'CRM',             desc: 'Customers, loyalty & attendance' },
  { key: 'ONLINE_ORDERS', label: 'Online Orders',   desc: 'Zomato / Swiggy feed' },
  { key: 'MULTI_OUTLET',  label: 'Multi-Outlet',    desc: 'Branch comparison & menu sync' },
  { key: 'DEVICES',       label: 'Devices',         desc: 'POS device management' },
  { key: 'ACCOUNTING',    label: 'Accounting',      desc: 'P&L reports & Tally export' },
  { key: 'DAY_CLOSE',     label: 'Day Close',       desc: 'End-of-day cash reconciliation' },
];

const MODE_DEFAULTS: Record<string, string[]> = {
  COUNTER:      ['KDS', 'INVENTORY', 'CRM', 'ONLINE_ORDERS', 'DEVICES', 'ACCOUNTING', 'DAY_CLOSE'],
  TABLE_SIMPLE: ['TABLES', 'KDS', 'INVENTORY', 'CRM', 'ONLINE_ORDERS', 'DEVICES', 'ACCOUNTING', 'DAY_CLOSE'],
  FULL_SERVICE: ['TABLES', 'RESERVATIONS', 'KDS', 'INVENTORY', 'CRM', 'ONLINE_ORDERS', 'MULTI_OUTLET', 'DEVICES', 'ACCOUNTING', 'DAY_CLOSE'],
};

export default function AddRestaurantPage() {
  const [form, setForm] = useState({
    restaurantName: '', ownerName: '', ownerEmail: '',
    ownerPhone: '', city: '', address: '',
  });
  const [operatingMode, setOperatingMode] = useState('FULL_SERVICE');
  const [enabledModules, setEnabledModules] = useState<string[]>(MODE_DEFAULTS['FULL_SERVICE']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleModeSelect = (mode: string) => {
    setOperatingMode(mode);
    setEnabledModules(MODE_DEFAULTS[mode] ?? []);
  };

  const toggleModule = (key: string) => {
    setEnabledModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const api = saApi();
      const res = await api.post('/super-admin/restaurants', {
        ...form,
        operatingMode,
        enabledModules,
      });
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.userMessage ?? JSON.stringify(err.response?.data) ?? 'Failed to create restaurant.');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    const { restaurant, owner } = result;
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <h2 className="font-bold text-white text-lg" style={{ fontFamily: "'Inter', sans-serif" }}>Restaurant Created!</h2>
              <p className="text-emerald-400 text-sm">{restaurant.name} is now on RestroSync</p>
            </div>
          </div>
          <div className="bg-slate-900 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Owner Login Credentials</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Mode</p>
                <p className="text-violet-400 font-medium mt-0.5">{restaurant.operatingMode}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Modules</p>
                <p className="text-slate-300 text-xs mt-0.5">{(restaurant.enabledModules ?? []).length} enabled</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Email</p>
                <p className="text-white mt-0.5">{owner.email}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Temp Password</p>
                <p className="text-amber-400 font-mono mt-0.5">{owner.tempPassword}</p>
              </div>
            </div>
            <div className="text-xs text-slate-500 bg-red-500/5 border border-amber-500/20 rounded-lg p-2.5 mt-2">
              ⚠️ Share these credentials with the owner. They must change password on first login.
            </div>
          </div>
          <div className="flex gap-3">
            <Link to={`/super-admin/restaurants/${restaurant.id}`}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold text-center transition-colors">
              View Restaurant
            </Link>
            <Link to="/super-admin/restaurants"
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold text-center transition-colors">
              All Restaurants
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inputCls = "w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500";

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/super-admin/restaurants" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>Add Restaurant</h1>
          <p className="text-slate-400 text-sm">Choose a mode — modules auto-fill, then fine-tune</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Basic Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Restaurant Details</p>
          {[
            { label: 'Restaurant Name', key: 'restaurantName', type: 'text', placeholder: 'e.g. Dosa Corner', required: true },
            { label: 'Owner Full Name', key: 'ownerName', type: 'text', placeholder: 'e.g. Ramesh Kumar', required: true },
            { label: 'Owner Email', key: 'ownerEmail', type: 'email', placeholder: 'owner@restaurant.com', required: true },
            { label: 'Owner Phone', key: 'ownerPhone', type: 'tel', placeholder: '9876543210', required: false },
            { label: 'City', key: 'city', type: 'text', placeholder: 'Bangalore', required: false },
            { label: 'Address', key: 'address', type: 'text', placeholder: '12 MG Road, Bangalore', required: false },
          ].map(({ label, key, type, placeholder, required }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                {label} {required && <span className="text-rose-400">*</span>}
              </label>
              <input
                type={type}
                value={(form as any)[key]}
                onChange={(e) => set(key, e.target.value)}
                required={required}
                placeholder={placeholder}
                className={inputCls}
              />
            </div>
          ))}
        </div>

        {/* Operating Mode */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Operating Mode</p>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => handleModeSelect(m.value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                  operatingMode === m.value
                    ? 'border-violet-500 bg-violet-500/10 text-white'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <span className="text-xl">{m.emoji}</span>
                <span className="text-xs font-semibold">{m.label}</span>
                <span className="text-[10px] text-slate-500 text-center leading-tight">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Module Toggles */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Feature Modules</p>
            <span className="text-xs text-violet-400">{enabledModules.length} / {MODULE_META.length} enabled</span>
          </div>
          <div className="space-y-2">
            {MODULE_META.map(({ key, label, desc }) => {
              const on = enabledModules.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleModule(key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                    on
                      ? 'border-violet-500/50 bg-violet-500/5'
                      : 'border-slate-800 bg-slate-800/30 opacity-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                    on ? 'bg-violet-600 border-violet-600' : 'border-slate-600'
                  }`}>
                    {on && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-colors disabled:opacity-60"
        >
          {loading ? 'Creating...' : 'Create Restaurant & Owner Account'}
        </button>
      </form>
    </div>
  );
}
