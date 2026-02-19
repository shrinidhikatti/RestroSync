import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export default function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/v1/auth/login`, form);
      const { user, accessToken, refreshToken } = res.data;
      if (user.role !== 'SUPER_ADMIN') {
        setError('Access denied. Super Admin credentials required.');
        return;
      }
      sessionStorage.setItem('sa_token', accessToken);
      sessionStorage.setItem('sa_refresh', refreshToken);
      sessionStorage.setItem('sa_user', JSON.stringify(user));
      navigate('/super-admin/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.userMessage ?? 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] p-12 relative overflow-hidden" style={{ background: '#0f172a' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-5 bg-violet-500" />
          <div className="absolute bottom-12 -left-16 w-72 h-72 rounded-full opacity-5 bg-violet-500" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        <div className="relative z-10">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-xl mb-8 bg-violet-600">
            SA
          </div>
          <h1 className="font-bold text-white text-4xl leading-tight mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>
            RestroSync<br />Super Admin
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-xs">
            Platform control center. Manage restaurants, plans, and system-wide configuration.
          </p>
        </div>
        <div className="relative z-10 space-y-3">
          {['Manage all restaurants', 'View platform analytics', 'Suspend / activate accounts', 'System health monitoring'].map((f) => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-violet-600">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-slate-300 text-sm">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm bg-violet-600">SA</div>
            <span className="font-bold text-slate-900 text-xl" style={{ fontFamily: "'Syne', sans-serif" }}>Super Admin</span>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-xl" style={{ fontFamily: "'Syne', sans-serif" }}>Platform Access</h2>
                <p className="text-slate-500 text-xs">Super Admin credentials only</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  placeholder="admin@restrosync.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-shadow"
                />
              </div>
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm">{error}</div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-60 hover:bg-violet-700 active:scale-[0.99] bg-violet-600"
              >
                {loading ? 'Signing in...' : 'Sign in to Platform'}
              </button>
            </form>
          </div>
          <p className="text-center text-xs text-slate-400 mt-4">
            Restaurant owner?{' '}
            <a href="/login" className="text-amber-600 hover:underline">Go to restaurant login</a>
          </p>
        </div>
      </div>
    </div>
  );
}
