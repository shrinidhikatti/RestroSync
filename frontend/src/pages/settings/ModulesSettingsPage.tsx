import React, { useState } from 'react';
import { restaurantApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

const MODULE_META: { key: string; label: string; desc: string; icon: string }[] = [
  { key: 'TABLES',        label: 'Tables',          desc: 'Table map, floor plan & seat management',         icon: '🪑' },
  { key: 'RESERVATIONS',  label: 'Reservations',    desc: 'Advance booking & guest management',              icon: '📅' },
  { key: 'KDS',           label: 'Kitchen Display', desc: 'Real-time KDS screen for kitchen staff',          icon: '🖥️' },
  { key: 'INVENTORY',     label: 'Inventory',       desc: 'Ingredients, recipes, stock & purchase orders',   icon: '📦' },
  { key: 'CRM',           label: 'CRM',             desc: 'Customers, loyalty points & credit (khata)',      icon: '👥' },
  { key: 'ONLINE_ORDERS', label: 'Online Orders',   desc: 'Zomato / Swiggy aggregator feed',                 icon: '🛵' },
  { key: 'MULTI_OUTLET',  label: 'Multi-Outlet',    desc: 'Branch comparison, menu push & stock transfers',  icon: '🏢' },
  { key: 'DEVICES',       label: 'Devices',         desc: 'POS device registration & management',            icon: '📱' },
  { key: 'ACCOUNTING',    label: 'Accounting',      desc: 'P&L reports & Tally XML export',                  icon: '📊' },
  { key: 'DAY_CLOSE',     label: 'Day Close',       desc: 'End-of-day cash reconciliation wizard',           icon: '🔒' },
];

export default function ModulesSettingsPage() {
  const { enabledModules, activeModules, setRestaurantConfig, operatingMode } = useAuthStore();
  const [active, setActive] = useState<string[]>(activeModules);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const toggle = (key: string) => {
    setSaved(false);
    setActive((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await restaurantApi.updateActiveModules(active);
      setRestaurantConfig(operatingMode, enabledModules, active);
      setSaved(true);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify([...active].sort()) !== JSON.stringify([...activeModules].sort());

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
          Feature Modules
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Turn off modules you don't use to keep your team's interface clean and simple.
          You can only enable modules included in your plan.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
        {MODULE_META.map(({ key, label, desc, icon }) => {
          const granted = enabledModules.includes(key);
          const isActive = active.includes(key);

          return (
            <div
              key={key}
              className={`flex items-center gap-4 px-5 py-4 transition-opacity ${!granted ? 'opacity-40' : ''}`}
            >
              <span className="text-2xl flex-shrink-0 w-8 text-center">{icon}</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">{label}</p>
                  {!granted && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 uppercase tracking-wide">
                      Not in plan
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>

              {/* Toggle */}
              <button
                type="button"
                disabled={!granted}
                onClick={() => granted && toggle(key)}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none ${
                  isActive && granted ? 'bg-violet-600' : 'bg-slate-700'
                } ${!granted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                title={!granted ? 'Upgrade your plan to enable this module' : undefined}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    isActive && granted ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Info box */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-400">
        <span className="text-slate-300 font-medium">Note: </span>
        Grayed-out modules are not included in your current plan. Contact your administrator to upgrade.
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        {saved && (
          <span className="text-emerald-400 text-sm font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Saved — sidebar updated
          </span>
        )}

        {hasChanges && !saved && (
          <span className="text-amber-400 text-xs">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}
