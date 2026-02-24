import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { saApi } from './useSuperAdmin';

export default function AddRestaurantPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    restaurantName: '', ownerName: '', ownerEmail: '',
    ownerPhone: '', city: '', address: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const api = saApi();
      const res = await api.post('/super-admin/restaurants', form);
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.userMessage ?? JSON.stringify(err.response?.data) ?? 'Failed to create restaurant.');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    const { restaurant, owner } = result;
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <h2 className="font-bold text-white text-lg" style={{ fontFamily: "'Inter', sans-serif" }}>Restaurant Created!</h2>
              <p className="text-emerald-400 text-sm">{restaurant.name} is now on RestroSync</p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Owner Login Credentials</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Restaurant ID</p>
                <p className="text-white font-mono text-xs mt-0.5">{restaurant.id}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Status</p>
                <p className="text-emerald-400 font-medium mt-0.5">{restaurant.status}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Email</p>
                <p className="text-white mt-0.5">{owner.email}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Temp Password</p>
                <p className="text-amber-400 font-mono mt-0.5">{owner.tempPassword}</p>
              </div>
            </div>
            <div className="text-xs text-slate-500 bg-red-500/5 border border-amber-500/20 rounded-lg p-2.5 mt-2">
              ⚠️ Share these credentials with the owner. They must change password on first login.
            </div>
          </div>

          <div className="flex gap-3">
            <Link to={`/super-admin/restaurants/${restaurant.id}`}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold text-center transition-colors">
              View Restaurant
            </Link>
            <Link to="/super-admin/restaurants"
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold text-center transition-colors">
              All Restaurants
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const fields = [
    { label: 'Restaurant Name', key: 'restaurantName', type: 'text', placeholder: 'e.g. Dosa Corner', required: true },
    { label: 'Owner Full Name', key: 'ownerName', type: 'text', placeholder: 'e.g. Ramesh Kumar', required: true },
    { label: 'Owner Email', key: 'ownerEmail', type: 'email', placeholder: 'owner@restaurant.com', required: true },
    { label: 'Owner Phone', key: 'ownerPhone', type: 'tel', placeholder: '9876543210', required: false },
    { label: 'City', key: 'city', type: 'text', placeholder: 'Bangalore', required: false },
    { label: 'Address', key: 'address', type: 'text', placeholder: '12 MG Road, Bangalore', required: false },
  ];

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/super-admin/restaurants" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>Add Restaurant</h1>
          <p className="text-slate-400 text-sm">A temp password will be auto-generated for the owner</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(({ label, key, type, placeholder, required }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                {label} {required && <span className="text-rose-400">*</span>}
              </label>
              <input
                type={type}
                value={(form as any)[key]}
                onChange={(e) => set(key, e.target.value)}
                required={required}
                placeholder={placeholder}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          ))}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-colors disabled:opacity-60"
          >
            {loading ? 'Creating...' : 'Create Restaurant & Owner Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
