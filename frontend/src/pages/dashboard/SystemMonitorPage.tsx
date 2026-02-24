import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { RefreshIcon } from '../../components/ui/Icons';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface HealthData {
  status: string;
  uptime: number;
  version: string;
  timestamp: string;
}

interface ServiceStatus {
  name: string;
  status: 'ok' | 'down' | 'loading';
  detail?: string;
}

function StatusBadge({ status }: { status: ServiceStatus['status'] }) {
  const styles = {
    ok:      'bg-emerald-100 text-emerald-700 border-emerald-200',
    down:    'bg-rose-100 text-rose-700 border-rose-200',
    loading: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  const dots = {
    ok:      'bg-emerald-500 animate-pulse',
    down:    'bg-rose-500',
    loading: 'bg-slate-400',
  };
  const labels = { ok: 'Online', down: 'Down', loading: '…' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
      {labels[status]}
    </span>
  );
}

function ServiceCard({ svc }: { svc: ServiceStatus }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 flex items-center justify-between shadow-sm">
      <div>
        <p className="text-sm font-semibold text-slate-800 font-display">{svc.name}</p>
        {svc.detail && <p className="text-xs text-slate-400 mt-0.5">{svc.detail}</p>}
      </div>
      <StatusBadge status={svc.status} />
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SystemMonitorPage() {
  const [health, setHealth]     = useState<HealthData | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'API Server', status: 'loading' },
    { name: 'PostgreSQL', status: 'loading' },
    { name: 'Redis',      status: 'loading' },
  ]);
  const [appVersion, setAppVersion] = useState<any>(null);
  const [serverTime, setServerTime] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function poll() {
    const [healthRes, dbRes, redisRes, verRes, timeRes] = await Promise.allSettled([
      axios.get(`${API}/api/v1/health`),
      axios.get(`${API}/api/v1/health/db`),
      axios.get(`${API}/api/v1/health/redis`),
      axios.get(`${API}/api/v1/config/app-version`),
      axios.get(`${API}/api/v1/time`),
    ]);

    if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data);

    const dbStatus    = dbRes.status    === 'fulfilled' ? dbRes.value.data.status    : 'down';
    const redisStatus = redisRes.status === 'fulfilled' ? redisRes.value.data.status : 'down';

    setServices([
      {
        name: 'API Server',
        status: healthRes.status === 'fulfilled' ? 'ok' : 'down',
        detail: healthRes.status === 'fulfilled'
          ? `v${healthRes.value.data.version} — up ${formatUptime(healthRes.value.data.uptime)}`
          : undefined,
      },
      { name: 'PostgreSQL', status: dbStatus as ServiceStatus['status'] },
      {
        name: 'Redis',
        status: redisStatus as ServiceStatus['status'],
        detail: redisRes.status === 'fulfilled'
          ? `Mem: ${redisRes.value.data.memoryUsage ?? '—'} | Clients: ${redisRes.value.data.connectedClients ?? '—'}`
          : undefined,
      },
    ]);

    if (verRes.status  === 'fulfilled') setAppVersion(verRes.value.data);
    if (timeRes.status === 'fulfilled') setServerTime(timeRes.value.data.serverTime);
  }

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const allLoading = services.every((s) => s.status === 'loading');
  const allOk      = services.every((s) => s.status === 'ok');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 anim-fade-up">
        <div>
          <h1 className="font-display font-bold text-slate-900 text-2xl">System Monitor</h1>
          <p className="text-slate-500 text-sm mt-0.5">Real-time platform health. Auto-refreshes every 30s.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border ${
            allLoading
              ? 'bg-slate-50 text-slate-500 border-slate-200'
              : allOk
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${allOk && !allLoading ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'}`} />
            {allLoading ? 'Checking…' : allOk ? 'All Systems Operational' : 'Degraded Performance'}
          </span>
          <button onClick={poll} className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
            <RefreshIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Services */}
      <div className="space-y-3 mb-6 anim-fade-up delay-50">
        {services.map((svc) => <ServiceCard key={svc.name} svc={svc} />)}
      </div>

      {/* Details */}
      {health && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Uptime',      value: formatUptime(health.uptime) },
            { label: 'Version',     value: `v${health.version}` },
            { label: 'Server Time', value: serverTime ? new Date(serverTime).toLocaleTimeString() : '—' },
            { label: 'Environment', value: 'Production' },
          ].map((item) => (
            <div key={item.label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">{item.label}</p>
              <p className="text-lg font-bold text-slate-800 mt-1 font-display">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* App version */}
      {appVersion && (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-4 font-display">Flutter App Versions</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400 font-display uppercase tracking-wide">Minimum Required</p>
              <p className="text-xl font-bold text-red-600 font-display mt-1">{appVersion.minAppVersion}</p>
              <p className="text-xs text-slate-400 mt-0.5">Devices below this will be force-updated</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-display uppercase tracking-wide">Latest Release</p>
              <p className="text-xl font-bold text-emerald-600 font-display mt-1">{appVersion.latestAppVersion}</p>
              {appVersion.updateUrl && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Download: <span className="text-amber-500 font-mono">{appVersion.updateUrl}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clock drift info */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
        <span className="text-xl">⏱</span>
        <div>
          <p className="text-sm font-semibold text-amber-800 font-display">Clock Drift Protection</p>
          <p className="text-xs text-amber-700 mt-1">
            All POS devices sync their clock with the server time on startup.
            If drift exceeds 5 minutes, the app shows a warning and blocks billing.
          </p>
        </div>
      </div>
    </div>
  );
}
