import { useState, useEffect } from 'react';
import axios from 'axios';

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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">POS Devices</h1>
          <p className="text-sm text-slate-400 mt-1">Manage tablets, billing machines, and KDS screens.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-xl text-sm transition-colors"
        >
          + Register Device
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Devices', value: devices.length },
          { label: 'Active',        value: active.length,   color: 'text-emerald-400' },
          { label: 'Inactive',      value: inactive.length, color: 'text-slate-500' },
        ].map((s) => (
          <div key={s.label} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 font-display ${s.color ?? 'text-white'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Device list */}
      {loading ? (
        <div className="text-center text-slate-500 py-12">Loading…</div>
      ) : devices.length === 0 ? (
        <div className="text-center text-slate-500 py-16">
          <p className="text-4xl mb-3">📟</p>
          <p className="font-medium">No devices registered yet.</p>
          <p className="text-sm mt-1">Register a tablet or POS machine to get started.</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                <th className="px-5 py-3 font-medium">Device Name</th>
                <th className="px-5 py-3 font-medium">Branch</th>
                <th className="px-5 py-3 font-medium">Last Seen</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Fingerprint</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {devices.map((d) => (
                <tr key={d.id} className={`hover:bg-slate-700/20 ${!d.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3 text-white font-medium">{d.name}</td>
                  <td className="px-5 py-3 text-slate-400">{d.branch?.name ?? d.branchId}</td>
                  <td className="px-5 py-3 text-slate-400">{timeAgo(d.lastSeen)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      d.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${d.isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      {d.isActive ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-xs">
                    {d.deviceFingerprint ? `${d.deviceFingerprint.slice(0, 12)}…` : '—'}
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    {d.isActive && (
                      <button
                        onClick={() => revoke(d.id)}
                        className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                    <button
                      onClick={() => remove(d.id)}
                      className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Register Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold text-white font-display">Register Device</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Device Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Billing Counter 1"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Branch</label>
                <select
                  value={form.branchId}
                  onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select branch…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Device Fingerprint (optional)</label>
                <input
                  type="text"
                  value={form.deviceFingerprint}
                  onChange={(e) => setForm((f) => ({ ...f, deviceFingerprint: e.target.value }))}
                  placeholder="MAC address or unique ID"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={register}
                disabled={!form.name || !form.branchId}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm transition-colors disabled:opacity-50"
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
