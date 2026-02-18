import { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface Config {
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  razorpayWebhookSecret?: string;
  upiVpa?: string;
  smsProvider?: string;
  smsApiKey?: string;
  smsSenderId?: string;
  whatsappApiUrl?: string;
  whatsappToken?: string;
  zomatoEnabled?: boolean;
  zomatoRestaurantId?: string;
  swiggyEnabled?: boolean;
  swiggyRestaurantId?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-white font-display">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
      />
    </div>
  );
}

function Toggle({ label, checked, onChange, description }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; description?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-300">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
          checked ? 'bg-amber-500' : 'bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function IntegrationsPage() {
  const [cfg, setCfg]       = useState<Config>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/v1/integrations/config`).then((r) => {
      if (r.data) {
        // Replace masked values with empty strings
        const clean: any = {};
        for (const [k, v] of Object.entries(r.data)) {
          clean[k] = v === '••••••••' ? '' : v;
        }
        setCfg(clean);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const set = (key: keyof Config) => (val: string | boolean) =>
    setCfg((prev) => ({ ...prev, [key]: val }));

  async function save() {
    setSaving(true);
    try {
      await axios.patch(`${API}/api/v1/integrations/config`, cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Loading…</div>;

  const webhookBase = `${API}/api/v1/integrations`;

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Integrations</h1>
        <p className="text-sm text-slate-400 mt-1">Payment gateways, food aggregators, and communication providers.</p>
      </div>

      {/* Razorpay */}
      <Section title="Razorpay (Online Payments)">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Key ID"           value={cfg.razorpayKeyId ?? ''}       onChange={set('razorpayKeyId')}       placeholder="rzp_live_..." />
          <Field label="Key Secret"       value={cfg.razorpayKeySecret ?? ''}   onChange={set('razorpayKeySecret')}   type="password" placeholder="••••••••" />
          <Field label="Webhook Secret"   value={cfg.razorpayWebhookSecret ?? ''} onChange={set('razorpayWebhookSecret')} type="password" placeholder="••••••••" />
        </div>
        <div className="mt-3 p-3 bg-slate-900 rounded-xl">
          <p className="text-xs text-slate-500">Webhook URL to configure in Razorpay Dashboard:</p>
          <code className="text-xs text-amber-400 break-all">{webhookBase}/razorpay/webhook/YOUR_RESTAURANT_ID</code>
        </div>
      </Section>

      {/* UPI */}
      <Section title="UPI / QR Payments">
        <Field
          label="UPI VPA (e.g. restaurant@okaxis)"
          value={cfg.upiVpa ?? ''}
          onChange={set('upiVpa')}
          placeholder="merchant@bankname"
        />
        <p className="text-xs text-slate-500">Used to generate QR codes at POS. Customers scan with any UPI app.</p>
      </Section>

      {/* SMS */}
      <Section title="SMS Notifications">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Provider</label>
            <select
              value={cfg.smsProvider ?? 'MSG91'}
              onChange={(e) => set('smsProvider')(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              <option value="MSG91">MSG91</option>
              <option value="TWILIO">Twilio</option>
              <option value="FAST2SMS">Fast2SMS</option>
            </select>
          </div>
          <Field label="API Key"    value={cfg.smsApiKey ?? ''}   onChange={set('smsApiKey')}   type="password" placeholder="••••••••" />
          <Field label="Sender ID"  value={cfg.smsSenderId ?? ''} onChange={set('smsSenderId')} placeholder="RSTRNT" />
        </div>
      </Section>

      {/* WhatsApp */}
      <Section title="WhatsApp Notifications">
        <div className="grid grid-cols-1 gap-4">
          <Field label="WhatsApp API URL (Meta Cloud API)"  value={cfg.whatsappApiUrl ?? ''} onChange={set('whatsappApiUrl')} placeholder="https://graph.facebook.com/v18.0/..." />
          <Field label="Access Token"                        value={cfg.whatsappToken ?? ''}  onChange={set('whatsappToken')}  type="password" placeholder="••••••••" />
        </div>
        <p className="text-xs text-slate-500">Customers receive a formatted bill via WhatsApp after payment.</p>
      </Section>

      {/* Zomato */}
      <Section title="Zomato (Online Orders)">
        <Toggle
          label="Enable Zomato Integration"
          description="Receive orders from Zomato in your dashboard"
          checked={cfg.zomatoEnabled ?? false}
          onChange={set('zomatoEnabled')}
        />
        {cfg.zomatoEnabled && (
          <Field label="Zomato Restaurant ID" value={cfg.zomatoRestaurantId ?? ''} onChange={set('zomatoRestaurantId')} placeholder="zomato-res-123" />
        )}
        <div className="mt-3 p-3 bg-slate-900 rounded-xl">
          <p className="text-xs text-slate-500">Zomato webhook URL:</p>
          <code className="text-xs text-amber-400 break-all">{webhookBase}/aggregator/webhook/zomato/YOUR_RESTAURANT_ID</code>
        </div>
      </Section>

      {/* Swiggy */}
      <Section title="Swiggy (Online Orders)">
        <Toggle
          label="Enable Swiggy Integration"
          description="Receive orders from Swiggy in your dashboard"
          checked={cfg.swiggyEnabled ?? false}
          onChange={set('swiggyEnabled')}
        />
        {cfg.swiggyEnabled && (
          <Field label="Swiggy Restaurant ID" value={cfg.swiggyRestaurantId ?? ''} onChange={set('swiggyRestaurantId')} placeholder="swiggy-res-456" />
        )}
        <div className="mt-3 p-3 bg-slate-900 rounded-xl">
          <p className="text-xs text-slate-500">Swiggy webhook URL:</p>
          <code className="text-xs text-amber-400 break-all">{webhookBase}/aggregator/webhook/swiggy/YOUR_RESTAURANT_ID</code>
        </div>
      </Section>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
