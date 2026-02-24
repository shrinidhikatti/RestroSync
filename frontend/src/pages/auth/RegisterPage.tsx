import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [form, setForm] = useState({
    restaurantName: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    dpdpaConsentGiven: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!form.dpdpaConsentGiven) {
      setError('You must agree to our privacy policy');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authApi.register({
        restaurantName: form.restaurantName,
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        password: form.password,
        dpdpaConsentGiven: true,
      });
      const { user, accessToken, refreshToken } = res.data;
      login(
        {
          userId: user.id ?? user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
          restaurantId: user.restaurantId,
          branchId: user.branchId,
        },
        accessToken,
        refreshToken
      );
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.userMessage ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow placeholder-slate-400";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg anim-fade-up">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-white text-sm"
            style={{ background: 'var(--accent)' }}
          >
            RS
          </div>
          <span className="font-display font-bold text-slate-900 text-xl">RestroSync</span>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
          <h2 className="font-display font-bold text-slate-900 text-2xl mb-1">Start your journey</h2>
          <p className="text-slate-500 text-sm mb-7">Create your restaurant account — it takes 60 seconds.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Restaurant name *</label>
              <input
                type="text"
                value={form.restaurantName}
                onChange={(e) => set('restaurantName', e.target.value)}
                required
                placeholder="e.g. The Biryani House"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Your name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
                placeholder="Owner / Manager name"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Confirm *</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => set('confirmPassword', e.target.value)}
                  required
                  placeholder="Repeat password"
                  className={inputClass}
                />
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.dpdpaConsentGiven}
                onChange={(e) => set('dpdpaConsentGiven', e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-red-500 focus:ring-red-500"
              />
              <span className="text-sm text-slate-500 leading-snug">
                I agree to the{' '}
                <a href="#" className="text-red-600 hover:underline">Privacy Policy</a>
                {' '}and consent to data processing as per DPDPA 2023.
              </span>
            </label>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold font-display text-slate-900 transition-all disabled:opacity-60 hover:brightness-95"
              style={{ background: 'var(--accent)' }}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-red-600 hover:text-red-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
