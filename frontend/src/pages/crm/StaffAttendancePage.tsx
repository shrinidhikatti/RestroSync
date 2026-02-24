import { useState, useEffect, useCallback } from 'react';
import { attendanceApi } from '../../lib/api';

function today() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function StaffAttendancePage() {
  const [records,  setRecords]  = useState<any[]>([]);
  const [meta,     setMeta]     = useState({ total: 0, page: 1, limit: 50, pages: 1 });
  const [summary,  setSummary]  = useState<any[]>([]);
  const [onDuty,   setOnDuty]   = useState<any[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState<'records' | 'summary' | 'on-duty'>('on-duty');

  const [from,  setFrom]  = useState(daysAgo(6));
  const [to,    setTo]    = useState(today());
  const [userId, setUser] = useState('');
  const [page,  setPage]  = useState(1);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const r = await attendanceApi.list({ userId: userId || undefined, from, to, page, limit: 50 });
      setRecords(r.data.data);
      setMeta(r.data.meta);
    } finally {
      setLoading(false);
    }
  }, [userId, from, to, page]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const r = await attendanceApi.summary(from, to);
      setSummary(r.data);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const loadOnDuty = useCallback(async () => {
    const r = await attendanceApi.onDuty();
    setOnDuty(r.data);
  }, []);

  useEffect(() => { loadOnDuty(); }, [loadOnDuty]);
  useEffect(() => {
    if (tab === 'records') loadRecords();
    else if (tab === 'summary') loadSummary();
  }, [tab, loadRecords, loadSummary]);

  function exportCsv() {
    const rows = [
      ['Staff', 'Clock In', 'Clock Out', 'Hours', 'Late'],
      ...records.map((r) => [
        r.user?.name ?? r.userId,
        new Date(r.clockIn).toISOString(),
        r.clockOut ? new Date(r.clockOut).toISOString() : '',
        r.totalHours ?? '',
        r.isLate ? 'Yes' : 'No',
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6 anim-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-800">Staff Attendance</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {onDuty.length > 0 && <span className="text-emerald-600 font-semibold">{onDuty.length} on duty now · </span>}
            Track clock-in/out and hours
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold rounded-xl transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border border-slate-200 rounded-xl overflow-hidden w-fit">
        {(['on-duty', 'records', 'summary'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t ? 'bg-red-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t === 'on-duty' ? `On Duty (${onDuty.length})` : t === 'records' ? 'Records' : 'Summary'}
          </button>
        ))}
      </div>

      {/* Filters (for records + summary) */}
      {(tab === 'records' || tab === 'summary') && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1">
            <input type="date" className="input text-sm w-36" value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            <span className="text-slate-400 text-xs">–</span>
            <input type="date" className="input text-sm w-36" value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          {tab === 'records' && (
            <input className="input text-sm w-48" placeholder="User ID…"
              value={userId} onChange={(e) => { setUser(e.target.value); setPage(1); }} />
          )}
        </div>
      )}

      {/* On Duty */}
      {tab === 'on-duty' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {onDuty.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">No staff currently clocked in.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Staff</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Clocked In</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Hours</th>
                </tr>
              </thead>
              <tbody>
                {onDuty.map((r: any) => {
                  const hrs = ((Date.now() - new Date(r.clockIn).getTime()) / 3600000).toFixed(1);
                  return (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                          <span className="font-semibold text-slate-800">{r.user?.name ?? r.userId}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">
                          {r.user?.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{fmtTime(r.clockIn)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">{hrs}h</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Records */}
      {tab === 'records' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="flex gap-2">
                {[0,1,2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-bounce"
                    style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            </div>
          ) : records.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-12">No records in this range.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Staff</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Clock In</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Clock Out</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Hours</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r: any) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{r.user?.name ?? r.userId.slice(0, 12)}</p>
                      <p className="text-xs text-slate-400">{r.user?.role}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(r.clockIn)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtTime(r.clockIn)}</td>
                    <td className="px-4 py-3 text-slate-600">{r.isOpen ? <span className="text-emerald-600 font-semibold">Active</span> : fmtTime(r.clockOut)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">
                      {r.totalHours != null ? `${r.totalHours}h` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.isLate && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">Late</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Summary */}
      {tab === 'summary' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="flex gap-2">
                {[0,1,2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-bounce"
                    style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            </div>
          ) : summary.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-12">No records in this range.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Staff</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Role</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Sessions</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Total Hours</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Late Days</th>
                </tr>
              </thead>
              <tbody>
                {summary.sort((a: any, b: any) => b.totalHours - a.totalHours).map((s: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{s.user?.name ?? s.user?.id?.slice(0, 12)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">{s.user?.role}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{s.sessions}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{s.totalHours}h</td>
                    <td className="px-4 py-3 text-right">
                      {s.lateDays > 0
                        ? <span className="text-orange-600 font-semibold">{s.lateDays}</span>
                        : <span className="text-slate-300">0</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pagination for records */}
      {tab === 'records' && meta.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Page {meta.page} of {meta.pages}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 text-sm rounded-xl border border-slate-200 disabled:opacity-40 hover:border-red-400 transition-colors">
              ← Prev
            </button>
            <button disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 text-sm rounded-xl border border-slate-200 disabled:opacity-40 hover:border-red-400 transition-colors">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
