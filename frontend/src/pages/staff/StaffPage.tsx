import React, { useEffect, useState } from 'react';
import api from '../../lib/axios';
import { Modal } from '../../components/ui/Modal';
import { RoleBadge } from '../../components/ui/Badge';
import { PlusIcon, SearchIcon, UsersIcon } from '../../components/ui/Icons';

interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
  branch?: { id: string; name: string };
}

const ROLES = ['OWNER','MANAGER','BILLER','CAPTAIN','KITCHEN'];

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', phone: '', role: 'BILLER',
    branchId: '', password: '',
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const fetchStaff = async () => {
    try {
      const [usersRes, branchRes] = await Promise.all([
        api.get('/users'),
        api.get('/branches'),
      ]);
      setStaff(usersRes.data);
      setBranches(branchRes.data);
    } catch {
      setStaff([]);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/auth/register-staff', {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        role: form.role,
        branchId: form.branchId || undefined,
        password: form.password,
      });
      await fetchStaff();
      setShowModal(false);
      setForm({ name: '', email: '', phone: '', role: 'BILLER', branchId: '', password: '' });
    } catch (err: any) {
      setError(err.response?.data?.userMessage ?? 'Failed to create staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (member: StaffMember) => {
    try {
      await api.patch(`/users/${member.id}`, { isActive: !member.isActive });
      setStaff((prev) => prev.map((s) => s.id === member.id ? { ...s, isActive: !s.isActive } : s));
    } catch {
      // ignore
    }
  };

  const filtered = staff.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 anim-fade-up">
        <div>
          <h1 className="font-display font-bold text-slate-900 text-2xl">Staff</h1>
          <p className="text-slate-500 text-sm mt-0.5">{staff.filter((s) => s.isActive).length} active members</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-display text-white hover:brightness-95"
          style={{ background: 'var(--accent)' }}
        >
          <PlusIcon className="w-4 h-4" /> Add Staff
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs mb-5 anim-fade-up delay-50">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search staff..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden anim-fade-up delay-100">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1,2,3,4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="skeleton w-10 h-10 rounded-full" />
                <div className="skeleton flex-1 h-4" />
                <div className="skeleton w-20 h-6 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <UsersIcon className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-display text-sm">{search ? 'No staff found' : 'No staff members yet'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Member','Role','Branch','Last Login','Status'].map((h) => (
                  <th key={h} className={`px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide ${h === 'Status' || h === 'Last Login' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((member, i) => {
                const initials = member.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <tr key={member.id} className="hover:bg-slate-50/60 transition-colors anim-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 font-display flex-shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{member.name}</p>
                          <p className="text-xs text-slate-400">{member.email ?? member.phone ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <RoleBadge role={member.role} />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-slate-500 text-xs">{member.branch?.name ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-slate-500 text-xs">
                        {member.lastLogin
                          ? new Date(member.lastLogin).toLocaleDateString('en-IN')
                          : 'Never'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleToggleActive(member)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold font-display transition-colors ${
                          member.isActive
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {member.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add staff modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setError(''); }}
        title="Add Staff Member"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.name || !form.password} className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:brightness-95" style={{ background: 'var(--accent)' }}>
              {saving ? 'Creating...' : 'Create Staff'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Full Name *</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Staff member name" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="staff@res.com" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91..." className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Role</label>
              <select value={form.role} onChange={(e) => set('role', e.target.value)} className={inputClass}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Branch</label>
              <select value={form.branchId} onChange={(e) => set('branchId', e.target.value)} className={inputClass}>
                <option value="">All branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Password *</label>
            <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Min. 8 characters" minLength={8} className={inputClass} />
          </div>
          {error && <p className="text-rose-500 text-sm">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
