import { useState } from 'react';
import api from '../../lib/axios';
import { useAuthStore } from '../../stores/auth.store';

export default function SecuritySettingsPage() {
  const { user } = useAuthStore();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pinForm, setPinForm] = useState({ pin: '', confirmPin: '' });
  const [loading, setLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pinMsg, setPinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (form.newPassword.length < 8) {
      setMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      await api.patch('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setMsg({ type: 'success', text: 'Password changed successfully.' });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.userMessage ?? 'Failed to change password.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinForm.pin !== pinForm.confirmPin) {
      setPinMsg({ type: 'error', text: 'PINs do not match.' });
      return;
    }
    if (!/^\d{4}$/.test(pinForm.pin)) {
      setPinMsg({ type: 'error', text: 'PIN must be exactly 4 digits.' });
      return;
    }
    setPinLoading(true);
    setPinMsg(null);
    try {
      await api.patch('/auth/set-pin', { pin: pinForm.pin });
      setPinMsg({ type: 'success', text: 'PIN updated. Use it for POS device login.' });
      setPinForm({ pin: '', confirmPin: '' });
    } catch (err: any) {
      setPinMsg({ type: 'error', text: err.response?.data?.userMessage ?? 'Failed to set PIN.' });
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
          Security
        </h1>
        <p className="text-slate-500 text-sm mt-1">Manage your password and POS PIN.</p>
      </div>

      {/* Account info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-900 font-bold text-lg flex-shrink-0"
          style={{ background: '#ef4444' }}
        >
          {user?.name?.charAt(0).toUpperCase() ?? 'U'}
        </div>
        <div>
          <p className="font-semibold text-slate-800">{user?.name}</p>
          <p className="text-sm text-slate-500">{user?.email}</p>
          <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wide">{user?.role}</p>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <h2 className="font-bold text-slate-900 text-base" style={{ fontFamily: "'Inter', sans-serif" }}>
          Change Password
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Password</label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              required
              placeholder="Min. 8 characters"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {msg && (
            <div className={`p-3 rounded-xl text-sm border ${
              msg.type === 'success'
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                : 'bg-rose-50 border-rose-100 text-rose-600'
            }`}>
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-slate-900 disabled:opacity-50 transition-all"
            style={{ background: '#ef4444' }}
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* POS PIN */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <div>
          <h2 className="font-bold text-slate-900 text-base" style={{ fontFamily: "'Inter', sans-serif" }}>
            POS Device PIN
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            4-digit PIN used for quick login on POS tablets and billing devices.
          </p>
        </div>
        <form onSubmit={handleSetPin} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={pinForm.pin}
                onChange={(e) => setPinForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                required
                placeholder="••••"
                maxLength={4}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-center tracking-[0.5em] font-bold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={pinForm.confirmPin}
                onChange={(e) => setPinForm((f) => ({ ...f, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                required
                placeholder="••••"
                maxLength={4}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-center tracking-[0.5em] font-bold"
              />
            </div>
          </div>

          {pinMsg && (
            <div className={`p-3 rounded-xl text-sm border ${
              pinMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                : 'bg-rose-50 border-rose-100 text-rose-600'
            }`}>
              {pinMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={pinLoading}
            className="w-full py-3 rounded-xl font-bold text-slate-900 disabled:opacity-50 transition-all"
            style={{ background: '#ef4444' }}
          >
            {pinLoading ? 'Saving...' : 'Set PIN'}
          </button>
        </form>
      </div>

      {/* Info card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-500">
        <strong className="text-slate-700">Security tip:</strong> PINs are locked for 15 minutes after 5 failed attempts.
        Use a strong password of at least 8 characters with a mix of letters and numbers.
      </div>
    </div>
  );
}
