import React, { useEffect, useState } from 'react';
import { restaurantApi } from '../../lib/api';
import { CheckIcon } from '../../components/ui/Icons';

const MODES = [
  {
    value: 'COUNTER',
    label: 'Counter Service',
    desc: 'Quick service, takeaway & delivery focused. Token-based ordering.',
    emoji: '🏪',
  },
  {
    value: 'TABLE_SIMPLE',
    label: 'Table Service (Simple)',
    desc: 'Basic table management without captain workflow.',
    emoji: '🍽️',
  },
  {
    value: 'FULL_SERVICE',
    label: 'Full Service',
    desc: 'Complete dine-in with captain, KDS, rounds and advanced billing.',
    emoji: '🍾',
  },
];

export default function RestaurantSettingsPage() {
  const [form, setForm] = useState({
    name: '', address: '', city: '', phone: '', email: '',
    gstin: '', fssaiNumber: '', operatingMode: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    restaurantApi.getMe().then((res) => {
      const r = res.data;
      setForm({
        name: r.name ?? '', address: r.address ?? '', city: r.city ?? '',
        phone: r.phone ?? '', email: r.email ?? '', gstin: r.gstin ?? '',
        fssaiNumber: r.fssaiNumber ?? '', operatingMode: r.operatingMode ?? '',
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      await restaurantApi.update({
        name: form.name, address: form.address, city: form.city,
        phone: form.phone, email: form.email, gstin: form.gstin,
        fssaiNumber: form.fssaiNumber,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = async (mode: string) => {
    set('operatingMode', mode);
    await restaurantApi.setMode(mode);
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white";
  const sectionCard = "bg-white rounded-2xl border border-slate-100 shadow-sm p-6";

  if (loading) return <div className="p-6"><div className="skeleton h-96 rounded-2xl" /></div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 anim-fade-up">
        <h1 className="font-display font-bold text-slate-900 text-2xl">Restaurant Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your restaurant profile and operating configuration</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Profile card */}
        <div className={`${sectionCard} anim-fade-up delay-50`}>
          <div className="flex items-center gap-4 mb-5">
            {/* Logo placeholder */}
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 flex-shrink-0">
              <span className="text-2xl">🍴</span>
            </div>
            <div>
              <p className="font-display font-semibold text-slate-800">Restaurant Logo</p>
              <button type="button" className="text-sm text-amber-600 hover:underline font-display mt-0.5">Upload image</button>
            </div>
          </div>

          <h2 className="font-display font-semibold text-slate-800 mb-4">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Restaurant Name *</label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="The Grand Kitchen" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="hello@restaurant.com" className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Address</label>
              <input type="text" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Full address" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">City</label>
              <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Mumbai" className={inputClass} />
            </div>
          </div>
        </div>

        {/* Compliance card */}
        <div className={`${sectionCard} anim-fade-up delay-100`}>
          <h2 className="font-display font-semibold text-slate-800 mb-4">Regulatory &amp; Compliance</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">GSTIN</label>
              <input type="text" value={form.gstin} onChange={(e) => set('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">FSSAI Number</label>
              <input type="text" value={form.fssaiNumber} onChange={(e) => set('fssaiNumber', e.target.value)} placeholder="10000000000000" className={inputClass} />
            </div>
          </div>
          {!form.fssaiNumber && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>FSSAI number is required for compliance. Add it to remove this warning.</span>
            </div>
          )}
        </div>

        {/* Operating mode */}
        <div className={`${sectionCard} anim-fade-up delay-150`}>
          <h2 className="font-display font-semibold text-slate-800 mb-1">Operating Mode</h2>
          <p className="text-slate-500 text-sm mb-4">This determines available features across your POS and kitchen screens.</p>
          <div className="grid gap-3">
            {MODES.map((mode) => {
              const active = form.operatingMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => handleModeChange(mode.value)}
                  className={`text-left p-4 rounded-2xl border-2 transition-all ${
                    active
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-2xl flex-shrink-0">{mode.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`font-display font-semibold ${active ? 'text-amber-700' : 'text-slate-800'}`}>
                          {mode.label}
                        </p>
                        {active && (
                          <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                            <CheckIcon className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{mode.desc}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-between pb-6 anim-fade-up delay-200">
          {success && (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-display">
              <CheckIcon className="w-4 h-4" /> Changes saved!
            </div>
          )}
          <div className="ml-auto">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold font-display text-slate-900 hover:brightness-95 disabled:opacity-60 transition-all"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
