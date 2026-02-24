import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/axios';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSent(true);
      if (res.data.resetToken) {
        // Dev mode: token returned directly
        setDevToken(res.data.resetToken);
      }
    } catch (err: any) {
      setError(err.response?.data?.userMessage ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
                Check your email
              </h2>
              <p className="text-slate-500 text-sm mt-2">
                If <strong>{email}</strong> is registered, we've sent a password reset link.
                It expires in 30 minutes.
              </p>
            </div>

            {devToken && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Dev Mode — Reset Token</p>
                <p className="text-xs font-mono text-amber-800 break-all">{devToken}</p>
                <Link
                  to={`/reset-password?token=${devToken}`}
                  className="mt-2 inline-block text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  → Click here to reset password
                </Link>
              </div>
            )}

            <Link
              to="/login"
              className="inline-block w-full py-3 rounded-xl font-bold text-slate-900 text-sm text-center transition-all"
              style={{ background: '#ef4444' }}
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-slate-900 text-lg mx-auto mb-4"
            style={{ background: '#ef4444', fontFamily: "'Inter', sans-serif" }}
          >
            RS
          </div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
            Forgot your password?
          </h1>
          <p className="text-slate-500 text-sm mt-2">
            Enter your email and we'll send a reset link.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@restaurant.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-slate-400"
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
              className="w-full py-3 rounded-xl font-bold text-slate-900 transition-all disabled:opacity-60"
              style={{ background: '#ef4444', fontFamily: "'Inter', sans-serif" }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Remember your password?{' '}
            <Link to="/login" className="font-semibold text-red-600 hover:text-red-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
