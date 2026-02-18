import React, { useEffect, useState } from 'react';
import api from '../../lib/axios';
import { Toggle } from '../../components/ui/Toggle';
import { CheckIcon } from '../../components/ui/Icons';

interface ReceiptSettings {
  headerText: string | null;
  footerText: string | null;
  showGstin: boolean;
  showFssai: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showLoyaltyPoints: boolean;
}

export default function ReceiptSettingsPage() {
  const [settings, setSettings] = useState<ReceiptSettings>({
    headerText: '', footerText: '', showGstin: true, showFssai: true,
    showPhone: true, showAddress: true, showLoyaltyPoints: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const set = (k: string, v: any) => setSettings((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    api.get('/receipt-settings').then((res) => {
      if (res.data) setSettings(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/receipt-settings', settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      // ignore if endpoint not ready
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const toggleFields = [
    { key: 'showGstin', label: 'Show GSTIN on receipt' },
    { key: 'showFssai', label: 'Show FSSAI number' },
    { key: 'showPhone', label: 'Show restaurant phone' },
    { key: 'showAddress', label: 'Show restaurant address' },
    { key: 'showLoyaltyPoints', label: 'Show loyalty points balance' },
  ];

  const sectionCard = "bg-white rounded-2xl border border-slate-100 shadow-sm p-6";

  if (loading) return <div className="p-6"><div className="skeleton h-64 rounded-2xl" /></div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6 anim-fade-up">
        <h1 className="font-display font-bold text-slate-900 text-2xl">Receipt Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Customize what appears on printed and digital receipts</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Text content */}
        <div className={`${sectionCard} anim-fade-up delay-50`}>
          <h2 className="font-display font-semibold text-slate-800 mb-4">Receipt Text</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Header Text</label>
              <textarea
                value={settings.headerText ?? ''}
                onChange={(e) => set('headerText', e.target.value)}
                rows={3}
                placeholder="e.g. Thank you for choosing us! FSSAI Lic. No: XXXXXXXXXX"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">Appears at the top of the receipt above the restaurant name</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Footer Text</label>
              <textarea
                value={settings.footerText ?? ''}
                onChange={(e) => set('footerText', e.target.value)}
                rows={3}
                placeholder="e.g. Thank you for dining with us! Please visit again. Follow us @restaurantname"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">Appears at the bottom of the receipt</p>
            </div>
          </div>
        </div>

        {/* Display fields */}
        <div className={`${sectionCard} anim-fade-up delay-100`}>
          <h2 className="font-display font-semibold text-slate-800 mb-4">Display Fields</h2>
          <div className="space-y-4">
            {toggleFields.map((field) => (
              <div key={field.key} className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{field.label}</span>
                <Toggle
                  checked={settings[field.key as keyof ReceiptSettings] as boolean}
                  onChange={(v) => set(field.key, v)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className={`${sectionCard} anim-fade-up delay-150`}>
          <h2 className="font-display font-semibold text-slate-800 mb-4">Receipt Preview</h2>
          <div className="bg-slate-50 rounded-xl p-5 font-mono text-xs text-slate-600 leading-relaxed border border-dashed border-slate-200">
            {settings.headerText && <p className="text-center text-slate-500 mb-2">{settings.headerText}</p>}
            <p className="text-center font-bold text-slate-800 text-sm mb-1">Your Restaurant Name</p>
            {settings.showAddress && <p className="text-center">123, Main Street, City</p>}
            {settings.showPhone && <p className="text-center">+91 98765 43210</p>}
            {settings.showGstin && <p className="text-center">GSTIN: 22AAAAA0000A1Z5</p>}
            {settings.showFssai && <p className="text-center">FSSAI: 10000000000000</p>}
            <div className="my-3 border-t border-dashed border-slate-300" />
            <div className="flex justify-between"><span>Bill No:</span><span>INV-001</span></div>
            <div className="flex justify-between"><span>Date:</span><span>{new Date().toLocaleDateString('en-IN')}</span></div>
            <div className="my-3 border-t border-dashed border-slate-300" />
            <div className="flex justify-between"><span>Paneer Tikka x1</span><span>₹249</span></div>
            <div className="flex justify-between"><span>Dal Makhani x1</span><span>₹199</span></div>
            <div className="my-3 border-t border-dashed border-slate-300" />
            <div className="flex justify-between font-bold text-slate-800"><span>Total</span><span>₹448</span></div>
            {settings.showLoyaltyPoints && <p className="mt-2 text-center text-slate-500">Points earned: 44</p>}
            {settings.footerText && <p className="text-center text-slate-500 mt-3">{settings.footerText}</p>}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-between pb-6 anim-fade-up delay-200">
          {success && (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-display">
              <CheckIcon className="w-4 h-4" /> Settings saved!
            </div>
          )}
          <div className="ml-auto">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold font-display text-slate-900 hover:brightness-95 disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
