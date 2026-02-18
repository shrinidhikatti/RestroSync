import React, { useState, useEffect, useCallback } from 'react';
import { reportsApi } from '../../lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function today() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
}

// ── JSON Diff ─────────────────────────────────────────────────────────────────

function JsonDiff({ oldVal, newVal }: { oldVal: any; newVal: any }) {
  const old = JSON.stringify(oldVal, null, 2);
  const nw  = JSON.stringify(newVal, null, 2);
  return (
    <div className="grid grid-cols-2 gap-3 text-xs mt-2">
      <div>
        <p className="font-semibold text-rose-600 mb-1">Before</p>
        <pre className="bg-rose-50 border border-rose-100 rounded-lg p-2 overflow-auto max-h-40 text-rose-800 whitespace-pre-wrap">
          {old ?? '—'}
        </pre>
      </div>
      <div>
        <p className="font-semibold text-emerald-600 mb-1">After</p>
        <pre className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 overflow-auto max-h-40 text-emerald-800 whitespace-pre-wrap">
          {nw ?? '—'}
        </pre>
      </div>
    </div>
  );
}

// ── Action Badge ──────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const color =
    action.includes('cancel') || action.includes('void')  ? 'bg-rose-100 text-rose-700'   :
    action.includes('create') || action.includes('add')   ? 'bg-emerald-100 text-emerald-700' :
    action.includes('update') || action.includes('patch') ? 'bg-blue-100 text-blue-700'   :
    action.includes('delete')                             ? 'bg-red-100 text-red-700'     :
    'bg-slate-100 text-slate-600';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{action}</span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [logs,    setLogs]    = useState<any[]>([]);
  const [meta,    setMeta]    = useState<{ total: number; page: number; limit: number; pages: number }>({
    total: 0, page: 1, limit: 50, pages: 1,
  });
  const [actors,  setActors]  = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Filters
  const [userId,   setUserId]   = useState('');
  const [action,   setAction]   = useState('');
  const [entity,   setEntity]   = useState('');
  const [entityId, setEntityId] = useState('');
  const [from,     setFrom]     = useState(daysAgo(6));
  const [to,       setTo]       = useState(today());
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);

  useEffect(() => {
    reportsApi.auditActors().then((r) => setActors(r.data)).catch(() => {});
    reportsApi.auditActions().then((r) => setActions(r.data)).catch(() => {});
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await reportsApi.auditLogs({
        userId: userId || undefined,
        action: action || undefined,
        entity: entity || undefined,
        entityId: entityId || undefined,
        from, to,
        search: search || undefined,
        page, limit: 50,
      });
      setLogs(r.data.data);
      setMeta(r.data.meta);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [userId, action, entity, entityId, from, to, search, page]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const rows = [
      ['Timestamp', 'Action', 'Entity', 'Entity ID', 'User ID'],
      ...logs.map((l) => [
        new Date(l.createdAt).toISOString(),
        l.action, l.entity, l.entityId ?? '', l.userId,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6 anim-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-800">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">{meta.total.toLocaleString()} total entries</p>
        </div>
        <button
          onClick={exportCsv}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

          <div>
            <label className="label">Actor (User ID)</label>
            <select className="input text-sm" value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1); }}>
              <option value="">All users</option>
              {actors.map((a) => <option key={a} value={a}>{a.slice(0, 12)}…</option>)}
            </select>
          </div>

          <div>
            <label className="label">Action</label>
            <select className="input text-sm" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="">All actions</option>
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Entity</label>
            <input
              className="input text-sm" placeholder="order, bill…"
              value={entity}
              onChange={(e) => { setEntity(e.target.value); setPage(1); }}
            />
          </div>

          <div>
            <label className="label">Entity ID</label>
            <input
              className="input text-sm" placeholder="UUID…"
              value={entityId}
              onChange={(e) => { setEntityId(e.target.value); setPage(1); }}
            />
          </div>

          <div>
            <label className="label">From</label>
            <input type="date" className="input text-sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>

          <div>
            <label className="label">To</label>
            <input type="date" className="input text-sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>

          <div className="md:col-span-3 lg:col-span-6">
            <label className="label">Search</label>
            <input
              className="input text-sm" placeholder="Search by action or entity ID…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="flex gap-2">
              {[0,1,2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-amber-400 animate-bounce"
                  style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-16">No audit logs found for the selected filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Entity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Entity ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">IP</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                    onClick={() => toggleRow(log.id)}
                  >
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                    <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{log.entity}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs truncate max-w-[120px]">
                      {log.entityId ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs truncate max-w-[100px]">
                      {log.userId.slice(0, 10)}…
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{log.ipAddress ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400">
                      <span className="text-xs">{expanded.has(log.id) ? '▲' : '▼'}</span>
                    </td>
                  </tr>
                  {expanded.has(log.id) && (
                    <tr>
                      <td colSpan={7} className="px-4 pb-4 bg-slate-50">
                        {log.oldValue || log.newValue
                          ? <JsonDiff oldVal={log.oldValue} newVal={log.newValue} />
                          : <p className="text-xs text-slate-400 mt-2">No value diff available.</p>
                        }
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {meta.page} of {meta.pages} · {meta.total} entries
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:border-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <button
              disabled={page >= meta.pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:border-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
