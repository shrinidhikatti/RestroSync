import React, { useEffect, useState } from 'react';
import { supplierApi } from '../../lib/api';
import toast from 'react-hot-toast';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Supplier | null>(null);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await supplierApi.list();
      setSuppliers(res.data);
    } catch {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', address: '' });
    setShowModal(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Supplier name required'); return; }
    try {
      const payload = {
        name:    form.name.trim(),
        phone:   form.phone  || undefined,
        email:   form.email  || undefined,
        address: form.address || undefined,
      };
      if (editing) {
        await supplierApi.update(editing.id, payload);
        toast.success('Supplier updated');
      } else {
        await supplierApi.create(payload);
        toast.success('Supplier created');
      }
      setShowModal(false);
      load();
    } catch {
      toast.error('Failed to save supplier');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this supplier?')) return;
    try {
      await supplierApi.delete(id);
      toast.success('Supplier deactivated');
      load();
    } catch {
      toast.error('Failed to deactivate supplier');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your ingredient suppliers</p>
        </div>
        <button
          onClick={openNew}
          className="bg-red-500 hover:bg-red-600 text-black font-semibold px-4 py-2 rounded-xl text-sm"
        >
          + Add Supplier
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.length === 0 ? (
            <div className="col-span-full text-center py-16 text-slate-400">
              No suppliers yet. Add your first supplier.
            </div>
          ) : suppliers.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-slate-800">{s.name}</h3>
                <div className="flex gap-3 text-xs">
                  <button onClick={() => openEdit(s)} className="text-slate-500 hover:text-slate-800">Edit</button>
                  <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-600">Deactivate</button>
                </div>
              </div>
              {s.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                  <span className="text-slate-400">📞</span> {s.phone}
                </div>
              )}
              {s.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                  <span className="text-slate-400">✉️</span> {s.email}
                </div>
              )}
              {s.address && (
                <div className="flex items-start gap-2 text-sm text-slate-500 mt-2">
                  <span className="text-slate-400">📍</span>
                  <span className="text-xs leading-relaxed">{s.address}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Edit Supplier' : 'New Supplier'}</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Company Name *</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input" placeholder="e.g. Fresh Farms Co." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Phone</label>
                  <input type="tel" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="input" placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input" placeholder="orders@supplier.com" />
                </div>
              </div>
              <div>
                <label className="label">Address</label>
                <textarea value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="input resize-none" rows={2} placeholder="Full address" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-semibold">Cancel</button>
              <button onClick={handleSave} className="flex-1 bg-red-500 hover:bg-red-600 text-black rounded-xl py-2 text-sm font-semibold">
                {editing ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
