import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login({ email: form.email, password: form.password });
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
      setError(err.response?.data?.userMessage ?? 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[42%] p-12 relative overflow-hidden"
        style={{ background: 'var(--sidebar-bg)' }}
      >
        {/* Geometric decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-5" style={{ background: 'var(--accent)' }} />
          <div className="absolute bottom-12 -left-16 w-72 h-72 rounded-full opacity-5" style={{ background: 'var(--accent)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-[0.03] border-2 border-red-500" />
          {/* Grid pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Brand */}
        <div className="relative z-10">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-display font-bold text-white text-xl mb-8"
            style={{ background: 'var(--accent)' }}
          >
            RS
          </div>
          <h1 className="font-display font-bold text-white text-4xl leading-tight mb-4">
            Restaurant<br />management<br />reimagined.
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-xs">
            One platform for menus, tables, billing, staff and everything in between.
          </p>
        </div>

        {/* Features */}
        <div className="relative z-10 space-y-4">
          {['Multi-branch operations', 'Real-time kitchen display', 'Smart discount engine', 'GST-ready billing'].map((f) => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent)' }}>
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-slate-300 text-sm font-display">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md anim-fade-up">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-white text-sm"
              style={{ background: 'var(--accent)' }}
            >
              RS
            </div>
            <span className="font-display font-bold text-slate-900 text-xl">RestroSync</span>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
            <h2 className="font-display font-bold text-slate-900 text-2xl mb-1">Welcome back</h2>
            <p className="text-slate-500 text-sm mb-7">Sign in to your restaurant dashboard</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Email address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  placeholder="you@restaurant.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow placeholder-slate-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-slate-700 font-display">Password</label>
                  <Link to="/forgot-password" className="text-xs text-red-600 hover:text-red-700 font-medium">
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow placeholder-slate-400"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold font-display text-slate-900 transition-all disabled:opacity-60 hover:brightness-95 active:scale-[0.99]"
                style={{ background: 'var(--accent)' }}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-6">
              New restaurant?{' '}
              <Link to="/register" className="font-semibold text-red-600 hover:text-red-700">
                Create account
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            Super Admin?{' '}
            <Link to="/super-admin/login" className="text-violet-500 hover:text-violet-400 font-medium">
              Platform login →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
