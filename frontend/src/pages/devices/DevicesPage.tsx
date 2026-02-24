import { useState, useEffect } from 'react';
import axios from 'axios';
import { PlusIcon, RefreshIcon, MonitorIcon } from '../../components/ui/Icons';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface Device {
  id: string;
  name: string;
  branchId: string;
  branch: { name: string };
  deviceFingerprint?: string;
  isActive: boolean;
  lastSeen?: string;
  registeredBy?: string;
  createdAt: string;
}

function timeAgo(date?: string) {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DevicesPage() {
  const [devices, setDevices]     = useState<Device[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState({ name: '', branchId: '', deviceFingerprint: '' });
  const [branches, setBranches]   = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    load();
    axios.get(`${API}/api/v1/branches`).then((r) => setBranches(r.data ?? [])).catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    axios.get(`${API}/api/v1/devices`).then((r) => setDevices(r.data ?? [])).catch(() => {}).finally(() => setLoading(false));
  }

  async function register() {
    if (!form.name || !form.branchId) return;
    await axios.post(`${API}/api/v1/devices`, form);
    setShowModal(false);
    setForm({ name: '', branchId: '', deviceFingerprint: '' });
    load();
  }

  async function revoke(id: string) {
    await axios.patch(`${API}/api/v1/devices/${id}/revoke`);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this device? This cannot be undone.')) return;
    await axios.delete(`${API}/api/v1/devices/${id}`);
    load();
  }

  const active   = devices.filter((d) => d.isActive);
  const inactive = devices.filter((d) => !d.isActive);

  const inputClass = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 anim-fade-up">
        <div>
          <h1 className="font-display font-bold text-slate-900 text-2xl">POS Devices</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage tablets, billing machines, and KDS screens.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
            <RefreshIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-display text-slate-900 hover:brightness-95"
            style={{ background: 'var(--accent)' }}
          >
            <PlusIcon className="w-4 h-4" /> Register Device
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6 anim-fade-up delay-50">
        {[
          { label: 'Total Devices', value: devices.length, bg: 'bg-white border-slate-200',       num: 'text-slate-800' },
          { label: 'Active',        value: active.length,   bg: 'bg-emerald-50 border-emerald-100', num: 'text-emerald-600' },
          { label: 'Inactive',      value: inactive.length, bg: 'bg-slate-50 border-slate-200',     num: 'text-slate-500' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border rounded-2xl p-5`}>
            <p className="text-xs font-semibold text-slate-500 font-display uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 font-display ${s.num}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Device list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <MonitorIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold font-display text-slate-700">No devices registered yet.</p>
          <p className="text-sm text-slate-400 mt-1">Register a tablet or POS machine to get started.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Device Name</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Branch</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Last Seen</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Fingerprint</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {devices.map((d) => (
                <tr key={d.id} className={`hover:bg-slate-50 transition-colors ${!d.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3.5 text-slate-800 font-semibold font-display">{d.name}</td>
                  <td className="px-5 py-3.5 text-slate-500">{d.branch?.name ?? d.branchId}</td>
                  <td className="px-5 py-3.5 text-slate-500">{timeAgo(d.lastSeen)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-display ${
                      d.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${d.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      {d.isActive ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">
                    {d.deviceFingerprint ? `${d.deviceFingerprint.slice(0, 12)}…` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {d.isActive && (
                        <button onClick={() => revoke(d.id)} className="text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors">
                          Revoke
                        </button>
                      )}
                      <button onClick={() => remove(d.id)} className="text-xs text-rose-500 hover:text-rose-600 font-medium transition-colors">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Register Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900 font-display">Register Device</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Device Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Billing Counter 1"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Branch</label>
                <select
                  value={form.branchId}
                  onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Select branch…</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Device Fingerprint <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={form.deviceFingerprint}
                  onChange={(e) => setForm((f) => ({ ...f, deviceFingerprint: e.target.value }))}
                  placeholder="MAC address or unique ID"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={register}
                disabled={!form.name || !form.branchId}
                className="flex-1 py-2.5 rounded-xl text-slate-900 font-semibold text-sm hover:brightness-95 disabled:opacity-50 transition-colors"
                style={{ background: 'var(--accent)' }}
              >
                Register
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
