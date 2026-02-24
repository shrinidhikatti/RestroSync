import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/axios';
import { restaurantApi } from '../../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Template { id: string; name: string; cuisine: string; }
interface Progress {
  modeSelected: boolean;
  menuAdded: boolean;
  taxConfigured: boolean;
  tablesConfigured: boolean;
  staffAdded: boolean;
  printerSetup: boolean;
  isDismissed: boolean;
}

const MODES = [
  {
    key: 'COUNTER',
    label: 'Counter / QSR',
    icon: '🧾',
    description: 'Fast-food or takeaway. Token numbers, no table assignment.',
  },
  {
    key: 'TABLE_SIMPLE',
    label: 'Casual Dining',
    icon: '🍽️',
    description: 'Tables with simple billing. Great for cafes and casual restaurants.',
  },
  {
    key: 'FULL_SERVICE',
    label: 'Full Service',
    icon: '🏨',
    description: 'Fine dining with courses, rounds, priorities, and advanced KDS.',
  },
];

const STEPS = ['Operating Mode', 'Menu Template', 'Legal & FSSAI', 'Done'];

// ─── Step components ─────────────────────────────────────────────────────────

function StepMode({ onNext }: { onNext: (mode: string) => Promise<void> }) {
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    if (!selected) return;
    setSaving(true);
    try { await onNext(selected); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
          How do you run your restaurant?
        </h2>
        <p className="text-slate-500 text-sm mt-1">This sets the default billing and order flow. You can change it later in Settings.</p>
      </div>
      <div className="space-y-3">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setSelected(m.key)}
            className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
              selected === m.key
                ? 'border-red-500 bg-red-50'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{m.icon}</span>
              <div className="flex-1">
                <p className={`font-bold text-base ${selected === m.key ? 'text-red-700' : 'text-slate-900'}`}
                   style={{ fontFamily: "'Inter', sans-serif" }}>
                  {m.label}
                </p>
                <p className="text-sm text-slate-500 mt-0.5">{m.description}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                selected === m.key ? 'border-red-500 bg-red-500' : 'border-slate-300'
              }`}>
                {selected === m.key && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={handleNext}
        disabled={!selected || saving}
        className="w-full py-3.5 rounded-xl font-bold text-slate-900 transition-all disabled:opacity-40"
        style={{ background: '#ef4444', fontFamily: "'Inter', sans-serif" }}
      >
        {saving ? 'Saving...' : 'Continue →'}
      </button>
    </div>
  );
}

function StepTemplate({ onNext, onSkip }: { onNext: (templateId: string) => Promise<void>; onSkip: () => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api.get('/onboarding/templates').then((r) => setTemplates(r.data)).finally(() => setLoading(false));
  }, []);

  const handleImport = async () => {
    if (!selected) return;
    setImporting(true);
    try { await onNext(selected); } finally { setImporting(false); }
  };

  const CUISINE_ICONS: Record<string, string> = {
    'South Indian': '🍛', 'North Indian': '🫓', 'Chinese': '🥡',
    'Fast Food': '🍔', 'Bakery': '🧁', 'Multi-Cuisine': '🍴',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
          Start with a menu template
        </h2>
        <p className="text-slate-500 text-sm mt-1">We'll pre-fill categories and popular items — you can edit everything after.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${
                selected === t.id ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <span className="text-2xl">{CUISINE_ICONS[t.cuisine] ?? '🍴'}</span>
              <p className={`font-semibold text-sm mt-2 ${selected === t.id ? 'text-red-700' : 'text-slate-800'}`}
                 style={{ fontFamily: "'Inter', sans-serif" }}>
                {t.name}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{t.cuisine}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
        >
          Skip — I'll add items manually
        </button>
        <button
          onClick={handleImport}
          disabled={!selected || importing}
          className="flex-1 py-3 rounded-xl font-bold text-slate-900 transition-all disabled:opacity-40"
          style={{ background: '#ef4444', fontFamily: "'Inter', sans-serif" }}
        >
          {importing ? 'Importing...' : 'Import & Continue →'}
        </button>
      </div>
    </div>
  );
}

function StepLegal({ onNext }: { onNext: (data: { fssai: string; gstin: string; consent: boolean }) => Promise<void> }) {
  const [fssai, setFssai] = useState('');
  const [gstin, setGstin] = useState('');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    setSaving(true);
    try { await onNext({ fssai, gstin, consent }); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
          Legal & Compliance
        </h2>
        <p className="text-slate-500 text-sm mt-1">Required for GST invoices and FSSAI compliance. You can update these later in Settings.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">FSSAI License Number</label>
          <input
            value={fssai}
            onChange={(e) => setFssai(e.target.value)}
            placeholder="e.g. 10019022004345"
            maxLength={14}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-slate-400"
          />
          <p className="text-xs text-slate-400 mt-1">14-digit number on your FSSAI certificate</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">GSTIN</label>
          <input
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            placeholder="e.g. 29ABCDE1234F1Z5"
            maxLength={15}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-slate-400 font-mono"
          />
          <p className="text-xs text-slate-400 mt-1">Leave blank if you're not GST-registered</p>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <input
            id="consent"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 accent-red-500 w-4 h-4 flex-shrink-0"
          />
          <label htmlFor="consent" className="text-sm text-slate-600 cursor-pointer">
            I agree to RestroSync's{' '}
            <a href="/privacy" target="_blank" className="text-red-600 font-semibold hover:underline">Privacy Policy</a>
            {' '}and confirm that customer data will be handled in accordance with DPDPA 2023.
          </label>
        </div>
      </div>

      <button
        onClick={handleNext}
        disabled={saving || !consent}
        className="w-full py-3.5 rounded-xl font-bold text-slate-900 transition-all disabled:opacity-40"
        style={{ background: '#ef4444', fontFamily: "'Inter', sans-serif" }}
      >
        {saving ? 'Saving...' : 'Complete Setup →'}
      </button>
      <button
        onClick={() => onNext({ fssai: '', gstin: '', consent: true })}
        className="w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
}

function StepDone({ progress, onGoToDashboard }: { progress: Progress | null; onGoToDashboard: () => void }) {
  const checks = [
    { label: 'Operating mode selected', done: progress?.modeSelected ?? false },
    { label: 'Menu template imported', done: progress?.menuAdded ?? false },
    { label: 'Tax groups configured', done: progress?.taxConfigured ?? false },
    { label: 'Tables configured', done: progress?.tablesConfigured ?? false },
    { label: 'Staff accounts added', done: progress?.staffAdded ?? false },
    { label: 'Receipt printer setup', done: progress?.printerSetup ?? false },
  ];

  const doneCount = checks.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
          You're almost ready!
        </h2>
        <p className="text-slate-500 text-sm mt-1">{doneCount}/{checks.length} setup tasks complete</p>
      </div>

      <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              c.done ? 'bg-emerald-500' : 'bg-slate-200'
            }`}>
              {c.done ? (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <div className="w-2 h-2 rounded-full bg-slate-400" />
              )}
            </div>
            <span className={`text-sm ${c.done ? 'text-slate-700' : 'text-slate-400'}`}>{c.label}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <button
          onClick={onGoToDashboard}
          className="w-full py-3.5 rounded-xl font-bold text-slate-900 transition-all"
          style={{ background: '#ef4444', fontFamily: "'Inter', sans-serif" }}
        >
          Go to Dashboard →
        </button>
        <p className="text-center text-xs text-slate-400">
          You can complete the remaining steps from the dashboard anytime.
        </p>
      </div>
    </div>
  );
}

// ─── Main Onboarding Page ────────────────────────────────────────────────────

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    api.get('/onboarding/progress').then((r) => {
      setProgress(r.data);
      // If already completed, go to dashboard
      if (r.data.isDismissed) navigate('/');
    }).catch(() => {});
  }, [navigate]);

  const handleModeSelect = async (mode: string) => {
    await restaurantApi.setMode(mode);
    await api.patch('/onboarding/progress', { modeSelected: true });
    setProgress((p) => p ? { ...p, modeSelected: true } : p);
    setStep(1);
  };

  const handleTemplateImport = async (templateId: string) => {
    await api.post('/onboarding/import-template', { templateId });
    await api.patch('/onboarding/progress', { menuAdded: true });
    setProgress((p) => p ? { ...p, menuAdded: true } : p);
    setStep(2);
  };

  const handleSkipTemplate = () => setStep(2);

  const handleLegal = async (data: { fssai: string; gstin: string; consent: boolean }) => {
    if (data.fssai || data.gstin) {
      await restaurantApi.update({
        ...(data.fssai ? { fssaiNumber: data.fssai } : {}),
        ...(data.gstin ? { gstin: data.gstin } : {}),
        ...(data.consent ? { dpdpaConsentGiven: true } : {}),
      });
    }
    setStep(3);
  };

  const handleDone = async () => {
    await api.patch('/onboarding/progress', { isDismissed: true });
    navigate('/');
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Left decorative panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[40%] p-12 relative overflow-hidden"
        style={{ background: '#0f172a' }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-5" style={{ background: '#ef4444' }} />
          <div className="absolute bottom-12 -left-16 w-72 h-72 rounded-full opacity-5" style={{ background: '#ef4444' }} />
        </div>

        <div className="relative z-10">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-slate-900 text-xl mb-8"
            style={{ background: '#ef4444' }}
          >
            RS
          </div>
          <h1 className="font-bold text-white text-3xl leading-tight mb-4" style={{ fontFamily: "'Inter', sans-serif" }}>
            Let's set up your restaurant.
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Just a few steps and you'll be ready to take your first order.
          </p>
        </div>

        {/* Step progress */}
        <div className="relative z-10 space-y-4">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                i < step ? 'bg-emerald-500 text-white' :
                i === step ? 'text-slate-900' : 'bg-slate-800 text-slate-500'
              }`}
              style={i === step ? { background: '#ef4444' } : {}}>
                {i < step ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : i + 1}
              </div>
              <span className={`text-sm font-semibold ${
                i === step ? 'text-white' : i < step ? 'text-slate-400' : 'text-slate-600'
              }`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right content panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-lg">
          {/* Mobile progress */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-red-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
            {step === 0 && <StepMode onNext={handleModeSelect} />}
            {step === 1 && <StepTemplate onNext={handleTemplateImport} onSkip={handleSkipTemplate} />}
            {step === 2 && <StepLegal onNext={handleLegal} />}
            {step === 3 && <StepDone progress={progress} onGoToDashboard={handleDone} />}
          </div>
        </div>
      </div>
    </div>
  );
}
