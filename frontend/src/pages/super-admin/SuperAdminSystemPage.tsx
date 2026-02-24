import { useState, useEffect, useRef } from 'react';
import { saApi } from './useSuperAdmin';

function Dot({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />;
  return ok
    ? <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
    : <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />;
}

export default function SuperAdminSystemPage() {
  const [health, setHealth] = useState<any>(null);
  const [db, setDb] = useState<any>(null);
  const [redis, setRedis] = useState<any>(null);
  const [appVersion, setAppVersion] = useState<any>(null);
  const [serverTime, setServerTime] = useState('');
  const intervalRef = useRef<any>(null);

  async function poll() {
    const api = saApi();
    const [h, d, r, v, t] = await Promise.allSettled([
      api.get('/health'),
      api.get('/health/db'),
      api.get('/health/redis'),
      api.get('/config/app-version'),
      api.get('/time'),
    ]);
    if (h.status === 'fulfilled') setHealth(h.value.data);
    if (d.status === 'fulfilled') setDb(d.value.data);
    if (r.status === 'fulfilled') setRedis(r.value.data);
    if (v.status === 'fulfilled') setAppVersion(v.value.data);
    if (t.status === 'fulfilled') setServerTime(t.value.data.serverTime);
  }

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, 30000);
    return () => clearInterval(intervalRef.current);
  }, []);

  function fmt(s: number) {
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  const services = [
    { name: 'API Server', ok: health ? true : null, detail: health ? `v${health.version} — up ${fmt(health.uptime)}` : undefined },
    { name: 'PostgreSQL', ok: db ? db.status === 'ok' : null, detail: undefined },
    { name: 'Redis', ok: redis ? redis.status === 'ok' : null, detail: redis ? `Mem: ${redis.memoryUsage} | Clients: ${redis.connectedClients}` : undefined },
  ];

  const allOk = services.every((s) => s.ok === true);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>System Monitor</h1>
          <p className="text-sm text-slate-400 mt-1">Platform health — auto-refreshes every 30s</p>
        </div>
        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border ${
          services.some(s => s.ok === null) ? 'bg-slate-800 text-slate-400 border-slate-700' :
          allOk ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
          'bg-rose-500/10 text-rose-400 border-rose-500/30'
        }`}>
          <Dot ok={allOk} />
          {services.some(s => s.ok === null) ? 'Checking...' : allOk ? 'All Systems Operational' : 'Degraded Performance'}
        </span>
      </div>

      {/* Services */}
      <div className="space-y-3">
        {services.map((svc) => (
          <div key={svc.name} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">{svc.name}</p>
              {svc.detail && <p className="text-xs text-slate-400 mt-0.5">{svc.detail}</p>}
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              svc.ok === null ? 'bg-slate-800 text-slate-400 border-slate-700' :
              svc.ok ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
              'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              <Dot ok={svc.ok} />
              {svc.ok === null ? '…' : svc.ok ? 'Online' : 'Down'}
            </span>
          </div>
        ))}
      </div>

      {/* Metrics */}
      {health && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Uptime', value: fmt(health.uptime) },
            { label: 'Version', value: `v${health.version}` },
            { label: 'Server Time', value: serverTime ? new Date(serverTime).toLocaleTimeString() : '—' },
            { label: 'Environment', value: 'Production' },
          ].map((item) => (
            <div key={item.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className="text-lg font-bold text-white mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* App version */}
      {appVersion && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: "'Inter', sans-serif" }}>Flutter App Versions</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-slate-400">Minimum Required</p>
              <p className="text-2xl font-bold text-amber-400 mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>{appVersion.minAppVersion}</p>
              <p className="text-xs text-slate-500 mt-0.5">Devices below this are force-updated</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Latest Release</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>{appVersion.latestAppVersion}</p>
              {appVersion.updateUrl && <p className="text-xs text-amber-400 mt-0.5 truncate">{appVersion.updateUrl}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="bg-red-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3">
        <span className="text-xl">⏱</span>
        <div>
          <p className="text-sm font-semibold text-amber-400">Clock Drift Protection</p>
          <p className="text-xs text-slate-400 mt-1">All POS devices sync their clock with server time on startup. If drift exceeds 5 minutes, billing is blocked.</p>
        </div>
      </div>
    </div>
  );
}
