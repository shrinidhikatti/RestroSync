import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import { Toggle } from '../../components/ui/Toggle';

interface PaymentMethod {
  key: string;
  label: string;
  icon: string;
  description: string;
}

const ALL_METHODS: PaymentMethod[] = [
  { key: 'CASH', label: 'Cash', icon: '💵', description: 'Accept cash payments at the counter.' },
  { key: 'CARD', label: 'Card (POS)', icon: '💳', description: 'Debit and credit card via physical terminal.' },
  { key: 'UPI', label: 'UPI / QR Code', icon: '📱', description: 'Google Pay, PhonePe, Paytm and all UPI apps.' },
  { key: 'WALLET', label: 'Digital Wallet', icon: '👛', description: 'Paytm Wallet, Amazon Pay, etc.' },
  { key: 'CREDIT', label: 'Customer Credit', icon: '📋', description: 'Post-paid credit for registered customers.' },
  { key: 'COMPLIMENTARY', label: 'Complimentary', icon: '🎁', description: 'Management comps — requires reason entry.' },
];

export default function PaymentSettingsPage() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    CASH: true,
    CARD: true,
    UPI: true,
    WALLET: false,
    CREDIT: false,
    COMPLIMENTARY: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    api.get('/restaurants/me').then((r) => {
      const methods = r.data?.enabledPaymentMethods as string[] | undefined;
      if (methods && methods.length > 0) {
        const map: Record<string, boolean> = {};
        ALL_METHODS.forEach((m) => { map[m.key] = methods.includes(m.key); });
        setEnabled(map);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = async (key: string) => {
    const next = { ...enabled, [key]: !enabled[key] };
    setEnabled(next);
    setSaving(key);
    try {
      await api.patch('/restaurants/me', {
        enabledPaymentMethods: Object.entries(next).filter(([, v]) => v).map(([k]) => k),
      });
    } catch {
      setEnabled((prev) => ({ ...prev, [key]: !next[key] })); // rollback
    } finally {
      setSaving('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
          Payment Methods
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Choose which payment modes appear in the billing screen and POS app.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {ALL_METHODS.map((m) => (
          <div key={m.key} className="flex items-center justify-between p-5 gap-4">
            <div className="flex items-center gap-4">
              <span className="text-2xl w-8 text-center">{m.icon}</span>
              <div>
                <p className="font-semibold text-slate-800 text-sm">{m.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>
              </div>
            </div>
            <div className="flex-shrink-0">
              {saving === m.key ? (
                <div className="w-8 h-5 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <Toggle checked={enabled[m.key] ?? false} onChange={() => toggle(m.key)} />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
        <strong>Note:</strong> Changes take effect immediately. POS devices will update on next sync or app restart.
      </div>
    </div>
  );
}
