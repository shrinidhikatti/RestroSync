import { useState, useEffect } from 'react';
import { loyaltyApi } from '../../lib/api';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function LoyaltySettingsPage() {
  const [config,   setConfig]   = useState<any>(null);
  const [events,   setEvents]   = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  const [pph, setPph]   = useState(''); // pointsPerHundred
  const [rdv, setRdv]   = useState(''); // redeemValue

  useEffect(() => {
    Promise.all([loyaltyApi.config(), loyaltyApi.upcomingEvents(14)])
      .then(([c, e]) => {
        setConfig(c.data);
        setPph(String(c.data.loyaltyPointsPerHundred));
        setRdv(String(c.data.loyaltyRedeemValue));
        setEvents(e.data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await loyaltyApi.updateConfig({
        loyaltyPointsPerHundred: parseInt(pph),
        loyaltyRedeemValue:      parseFloat(rdv),
      });
      setConfig(r.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="flex gap-2">
        {[0,1,2].map((i) => (
          <div key={i} className="w-2 h-2 rounded-full bg-amber-400 animate-bounce"
            style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    </div>
  );

  // Preview: earn + redeem example
  const earnRate  = parseInt(pph) || 10;
  const redeemVal = parseFloat(rdv) || 0.5;

  return (
    <div className="p-6 space-y-8 anim-fade-up max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold font-display text-slate-800">Loyalty Program</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure earn rate, redemption value, and view upcoming events</p>
      </div>

      {/* Config Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Program Settings</h2>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="label">Points earned per ₹100 spent</label>
            <input
              className="input"
              type="number" min="1"
              value={pph}
              onChange={(e) => setPph(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">e.g. 10 = customer earns 10 pts per ₹100</p>
          </div>
          <div>
            <label className="label">1 point = ₹ value</label>
            <input
              className="input"
              type="number" min="0" step="0.1"
              value={rdv}
              onChange={(e) => setRdv(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">e.g. 0.50 = 100 pts = ₹50 off</p>
          </div>
        </div>

        {/* Live Preview */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">Preview (for ₹1,000 order)</p>
          <div className="flex gap-8 text-sm">
            <div>
              <p className="text-amber-600">Points Earned</p>
              <p className="text-xl font-bold text-amber-800 font-display">
                {Math.floor((1000 / 100) * earnRate)} pts
              </p>
            </div>
            <div>
              <p className="text-amber-600">100 pts = Discount</p>
              <p className="text-xl font-bold text-amber-800 font-display">
                ₹{(100 * redeemVal).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {/* Upcoming Events */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">
          Upcoming Birthdays & Anniversaries (next 14 days)
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-400">No upcoming events.</p>
        ) : (
          <div className="space-y-3">
            {events.map((e, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                  e.event === 'BIRTHDAY' ? 'bg-pink-100' : 'bg-purple-100'
                }`}>
                  {e.event === 'BIRTHDAY' ? '🎂' : '💍'}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{e.name ?? 'Unknown'}</p>
                  <p className="text-xs text-slate-500">{e.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-600">
                    {e.event === 'BIRTHDAY' ? 'Birthday' : 'Anniversary'}
                  </p>
                  <p className="text-sm font-bold text-amber-600">{fmtDate(e.date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
