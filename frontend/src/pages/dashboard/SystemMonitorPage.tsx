import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

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
    ok:      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
    down:    'bg-rose-500/10 text-rose-400 border border-rose-500/30',
    loading: 'bg-slate-700 text-slate-400 border border-slate-600',
  };
  const labels = { ok: 'Online', down: 'Down', loading: '…' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'ok' ? 'bg-emerald-400 animate-pulse' : status === 'down' ? 'bg-rose-400' : 'bg-slate-500'}`} />
      {labels[status]}
    </span>
  );
}

function ServiceCard({ svc }: { svc: ServiceStatus }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-white">{svc.name}</p>
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
  const [health, setHealth]   = useState<HealthData | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'API Server',    status: 'loading' },
    { name: 'PostgreSQL',    status: 'loading' },
    { name: 'Redis',         status: 'loading' },
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

    const dbStatus  = dbRes.status === 'fulfilled' ? dbRes.value.data.status : 'down';
    const redisStatus = redisRes.status === 'fulfilled' ? redisRes.value.data.status : 'down';

    setServices([
      {
        name: 'API Server',
        status: healthRes.status === 'fulfilled' ? 'ok' : 'down',
        detail: healthRes.status === 'fulfilled' ? `v${healthRes.value.data.version} — up ${formatUptime(healthRes.value.data.uptime)}` : undefined,
      },
      {
        name: 'PostgreSQL',
        status: dbStatus as ServiceStatus['status'],
      },
      {
        name: 'Redis',
        status: redisStatus as ServiceStatus['status'],
        detail: redisRes.status === 'fulfilled' ? `Mem: ${redisRes.value.data.memoryUsage ?? '—'} | Clients: ${redisRes.value.data.connectedClients ?? '—'}` : undefined,
      },
    ]);

    if (verRes.status === 'fulfilled') setAppVersion(verRes.value.data);
    if (timeRes.status === 'fulfilled') setServerTime(timeRes.value.data.serverTime);
  }

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const allOk = services.every((s) => s.status === 'ok');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">System Monitor</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time platform health. Auto-refreshes every 30s.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${
            services.some((s) => s.status === 'loading')
              ? 'bg-slate-700 text-slate-400'
              : allOk
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${allOk ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            {allOk ? 'All Systems Operational' : 'Degraded Performance'}
          </span>
        </div>
      </div>

      {/* Services */}
      <div className="space-y-3">
        {services.map((svc) => <ServiceCard key={svc.name} svc={svc} />)}
      </div>

      {/* Details */}
      {health && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Uptime',       value: formatUptime(health.uptime) },
            { label: 'Version',      value: `v${health.version}` },
            { label: 'Server Time',  value: serverTime ? new Date(serverTime).toLocaleTimeString() : '—' },
            { label: 'Environment',  value: 'Production' },
          ].map((item) => (
            <div key={item.label} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className="text-lg font-bold text-white mt-1 font-display">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* App version */}
      {appVersion && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3 font-display">Flutter App Versions</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400">Minimum Required</p>
              <p className="text-lg font-bold text-amber-400 font-display">{appVersion.minAppVersion}</p>
              <p className="text-xs text-slate-500 mt-0.5">Devices below this will be force-updated</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Latest Release</p>
              <p className="text-lg font-bold text-emerald-400 font-display">{appVersion.latestAppVersion}</p>
              {appVersion.updateUrl && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Download: <span className="text-amber-400">{appVersion.updateUrl}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clock drift info */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3">
        <span className="text-xl">⏱</span>
        <div>
          <p className="text-sm font-semibold text-amber-400">Clock Drift Protection</p>
          <p className="text-xs text-slate-400 mt-1">
            All POS devices sync their clock with the server time on startup.
            If drift exceeds 5 minutes, the app shows a warning and blocks billing.
          </p>
        </div>
      </div>
    </div>
  );
}
