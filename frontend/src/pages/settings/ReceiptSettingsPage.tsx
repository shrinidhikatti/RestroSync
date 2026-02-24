import React, { useEffect, useState } from 'react';
import { receiptApi } from '../../lib/api';
import { Toggle } from '../../components/ui/Toggle';
import { CheckIcon } from '../../components/ui/Icons';

interface ReceiptSettings {
  headerLine1: string;
  headerLine2: string;
  headerLine3: string;
  gstin: string;
  fssaiNumber: string;
  footerLine1: string;
  footerLine2: string;
  footerLine3: string;
  paperWidth: string;
  showLogo: boolean;
  showGstBreakdown: boolean;
  showItemTax: boolean;
  showFssai: boolean;
  showOrderNumber: boolean;
  showTableNumber: boolean;
  showCustomerName: boolean;
  showDateTime: boolean;
  showUpiQr: boolean;
  kotShowItemPrice: boolean;
}

const DEFAULTS: ReceiptSettings = {
  headerLine1: '', headerLine2: '', headerLine3: '',
  gstin: '', fssaiNumber: '',
  footerLine1: 'Thank you! Visit again', footerLine2: '', footerLine3: '',
  paperWidth: '80mm', showLogo: false,
  showGstBreakdown: true, showItemTax: false, showFssai: true,
  showOrderNumber: true, showTableNumber: true, showCustomerName: true,
  showDateTime: true, showUpiQr: false, kotShowItemPrice: false,
};

export default function ReceiptSettingsPage() {
  const [settings, setSettings] = useState<ReceiptSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof ReceiptSettings, v: any) =>
    setSettings((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    receiptApi.get().then((res) => {
      if (res.data) setSettings({ ...DEFAULTS, ...res.data });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await receiptApi.update(settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const card = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-6';
  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500';

  if (loading) return <div className="p-6"><div className="skeleton h-64 rounded-2xl" /></div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6 anim-fade-up">
        <h1 className="font-display font-bold text-slate-900 text-2xl">Receipt Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Customize printed bills and KOT tickets</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">

        {/* Header Lines */}
        <div className={`${card} anim-fade-up`}>
          <h2 className="font-display font-semibold text-slate-800 mb-4">Header Lines</h2>
          <div className="space-y-3">
            {(['headerLine1', 'headerLine2', 'headerLine3'] as const).map((k, i) => (
              <div key={k}>
                <label className="block text-xs font-medium text-slate-500 mb-1 font-display">Line {i + 1}</label>
                <input
                  type="text"
                  value={settings[k]}
                  onChange={(e) => set(k, e.target.value)}
                  placeholder={i === 0 ? 'e.g. FSSAI Lic. No: XXXXXXXXXX' : i === 1 ? 'e.g. Pure Veg Restaurant' : ''}
                  className={inputCls}
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 font-display">GSTIN</label>
                <input
                  type="text"
                  value={settings.gstin}
                  onChange={(e) => set('gstin', e.target.value)}
                  placeholder="22AAAAA0000A1Z5"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 font-display">FSSAI Number</label>
                <input
                  type="text"
                  value={settings.fssaiNumber}
                  onChange={(e) => set('fssaiNumber', e.target.value)}
                  placeholder="10000000000000"
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Lines */}
        <div className={`${card} anim-fade-up delay-50`}>
          <h2 className="font-display font-semibold text-slate-800 mb-4">Footer Lines</h2>
          <div className="space-y-3">
            {(['footerLine1', 'footerLine2', 'footerLine3'] as const).map((k, i) => (
              <div key={k}>
                <label className="block text-xs font-medium text-slate-500 mb-1 font-display">Line {i + 1}</label>
                <input
                  type="text"
                  value={settings[k]}
                  onChange={(e) => set(k, e.target.value)}
                  placeholder={i === 0 ? 'Thank you! Visit again' : ''}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Print Options */}
        <div className={`${card} anim-fade-up delay-100`}>
          <h2 className="font-display font-semibold text-slate-800 mb-4">Print Options</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 font-display">Paper Width</label>
              <select
                value={settings.paperWidth}
                onChange={(e) => set('paperWidth', e.target.value)}
                className={inputCls}
              >
                <option value="58mm">58mm (Narrow)</option>
                <option value="80mm">80mm (Standard)</option>
                <option value="A4">A4 (Full Page)</option>
              </select>
            </div>
            {([
              { key: 'showLogo',         label: 'Print restaurant logo' },
              { key: 'showGstBreakdown', label: 'Show GST breakdown (CGST / SGST)' },
              { key: 'showItemTax',      label: 'Show per-item tax' },
              { key: 'showFssai',        label: 'Print FSSAI number' },
              { key: 'showOrderNumber',  label: 'Print order / bill number' },
              { key: 'showTableNumber',  label: 'Print table number' },
              { key: 'showCustomerName', label: 'Print customer name' },
              { key: 'showDateTime',     label: 'Print date & time' },
              { key: 'showUpiQr',        label: 'Show UPI QR code for payment' },
            ] as { key: keyof ReceiptSettings; label: string }[]).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{label}</span>
                <Toggle
                  checked={settings[key] as boolean}
                  onChange={(v) => set(key, v)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* KOT Options */}
        <div className={`${card} anim-fade-up delay-150`}>
          <h2 className="font-display font-semibold text-slate-800 mb-1">KOT Ticket Options</h2>
          <p className="text-xs text-slate-400 mb-4">Settings for Kitchen Order Tickets sent to the kitchen printer</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Show item price on KOT</span>
            <Toggle
              checked={settings.kotShowItemPrice}
              onChange={(v) => set('kotShowItemPrice', v)}
            />
          </div>
        </div>

        {/* Receipt Preview */}
        <div className={`${card} anim-fade-up delay-200`}>
          <h2 className="font-display font-semibold text-slate-800 mb-4">Preview</h2>
          <div className="bg-slate-50 rounded-xl p-5 font-mono text-xs text-slate-600 leading-relaxed border border-dashed border-slate-200">
            {settings.headerLine1 && <p className="text-center text-slate-500">{settings.headerLine1}</p>}
            {settings.headerLine2 && <p className="text-center text-slate-500">{settings.headerLine2}</p>}
            {settings.headerLine3 && <p className="text-center text-slate-500 mb-2">{settings.headerLine3}</p>}
            <p className="text-center font-bold text-slate-800 text-sm">Your Restaurant Name</p>
            <p className="text-center">+91 98765 43210</p>
            {settings.gstin && <p className="text-center">GSTIN: {settings.gstin}</p>}
            {settings.showFssai && settings.fssaiNumber && <p className="text-center">FSSAI: {settings.fssaiNumber}</p>}
            <div className="my-2 border-t border-dashed border-slate-300" />
            {settings.showOrderNumber && <div className="flex justify-between"><span>Bill No:</span><span>INV/2526/0001</span></div>}
            {settings.showDateTime && <div className="flex justify-between"><span>Date:</span><span>{new Date().toLocaleDateString('en-IN')} {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></div>}
            {settings.showTableNumber && <div className="flex justify-between"><span>Table:</span><span>T5</span></div>}
            {settings.showCustomerName && <div className="flex justify-between"><span>Customer:</span><span>Ravi Kumar</span></div>}
            <div className="my-2 border-t border-dashed border-slate-300" />
            <div className="flex justify-between"><span>Paneer Tikka x2</span><span>₹498</span></div>
            <div className="flex justify-between"><span>Dal Makhani x1</span><span>₹199</span></div>
            <div className="my-2 border-t border-dashed border-slate-300" />
            {settings.showGstBreakdown && (
              <>
                <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>₹697</span></div>
                <div className="flex justify-between text-slate-400"><span>CGST 2.5%</span><span>₹17.43</span></div>
                <div className="flex justify-between text-slate-400"><span>SGST 2.5%</span><span>₹17.43</span></div>
              </>
            )}
            <div className="flex justify-between font-bold text-slate-800 text-sm mt-1"><span>Total</span><span>₹731.86</span></div>
            {settings.footerLine1 && <p className="text-center text-slate-500 mt-3">{settings.footerLine1}</p>}
            {settings.footerLine2 && <p className="text-center text-slate-500">{settings.footerLine2}</p>}
            {settings.footerLine3 && <p className="text-center text-slate-500">{settings.footerLine3}</p>}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-between pb-6 anim-fade-up delay-200">
          <div>
            {success && (
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-display">
                <CheckIcon className="w-4 h-4" /> Settings saved!
              </div>
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold font-display text-white hover:brightness-95 disabled:opacity-60"
            style={{ background: 'var(--accent)' }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
