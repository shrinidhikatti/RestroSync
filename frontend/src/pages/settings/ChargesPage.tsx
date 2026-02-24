import { useState, useEffect } from 'react';
import { taxApi } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import { PlusIcon, TrashIcon, EditIcon } from '../../components/ui/Icons';
import { Toggle } from '../../components/ui/Toggle';

interface Charge {
  id: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  isActive: boolean;
  applicableTo: string;
}

const EMPTY_FORM = { name: '', type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED', value: '10', applicableTo: 'ALL' };

export default function ChargesPage() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCharge, setEditCharge] = useState<Charge | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    try {
      const r = await taxApi.getCharges();
      setCharges(r.data);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEditCharge(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (c: Charge) => {
    setEditCharge(c);
    setForm({ name: c.name, type: c.type, value: String(c.value), applicableTo: c.applicableTo });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.value) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        value: parseFloat(form.value),
        applicableTo: form.applicableTo,
        isActive: true,
      };
      if (editCharge) {
        await taxApi.updateCharge(editCharge.id, payload);
      } else {
        await taxApi.createCharge(payload);
      }
      await fetchAll();
      setShowModal(false);
    } catch {}
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this charge?')) return;
    try {
      await taxApi.deleteCharge(id);
      setCharges((prev) => prev.filter((c) => c.id !== id));
    } catch {}
  };

  const toggleActive = async (charge: Charge) => {
    try {
      await taxApi.updateCharge(charge.id, { isActive: !charge.isActive });
      setCharges((prev) => prev.map((c) => c.id === charge.id ? { ...c, isActive: !c.isActive } : c));
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
            Service Charges
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Surcharges applied automatically to bills (e.g. Service Charge, Packaging Fee).
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-900 font-semibold text-sm"
          style={{ background: '#ef4444' }}
        >
          <PlusIcon className="w-4 h-4" />
          Add Charge
        </button>
      </div>

      {charges.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">No service charges configured yet.</p>
          <button onClick={openCreate} className="mt-4 text-red-600 font-semibold text-sm hover:text-red-700">
            + Add your first charge
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {charges.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-5 gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">{c.name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                    {c.type === 'PERCENTAGE' ? `${c.value}%` : `₹${c.value}`}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                    {c.applicableTo === 'DINE_IN' ? 'Dine-In only' : 'All orders'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Toggle checked={c.isActive} onChange={() => toggleActive(c)} />
                <button
                  onClick={() => openEdit(c)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <EditIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editCharge ? 'Edit Charge' : 'Add Service Charge'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Charge Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Service Charge"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'PERCENTAGE' | 'FIXED' }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Value {form.type === 'PERCENTAGE' ? '(%)' : '(₹)'}
              </label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                min="0"
                step="0.5"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Applies To</label>
            <div className="flex gap-3">
              {[{ key: 'ALL', label: 'All Orders' }, { key: 'DINE_IN', label: 'Dine-In Only' }].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setForm((f) => ({ ...f, applicableTo: opt.key }))}
                  className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                    form.applicableTo === opt.key
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="w-full py-3 rounded-xl font-bold text-slate-900 disabled:opacity-50"
            style={{ background: '#ef4444' }}
          >
            {saving ? 'Saving...' : editCharge ? 'Update Charge' : 'Add Charge'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
