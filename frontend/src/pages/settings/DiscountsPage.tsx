import React, { useEffect, useState } from 'react';
import { discountApi } from '../../lib/api';
import { Drawer } from '../../components/ui/Drawer';
import { PlusIcon, EditIcon, TrashIcon, TagIcon } from '../../components/ui/Icons';

interface Discount {
  id: string;
  couponCode: string | null;
  name: string;
  type: 'FLAT' | 'PERCENTAGE';
  scope: string;
  value: number;
  startDate: string | null;
  endDate: string | null;
  usageCount: number;
  maxUsageTotal: number | null;
  isActive: boolean;
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editTarget, setEditTarget] = useState<Discount | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '', name: '', type: 'PERCENTAGE', scope: 'BILL',
    value: '', minOrderValue: '', maxDiscount: '',
    validFrom: '', validTo: '',
    happyHourStart: '', happyHourEnd: '',
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const fetchDiscounts = async () => {
    try {
      const res = await discountApi.getAll();
      setDiscounts(res.data);
    } catch {
      setDiscounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDiscounts(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ code: '', name: '', type: 'PERCENTAGE', scope: 'BILL', value: '', minOrderValue: '', maxDiscount: '', validFrom: '', validTo: '', happyHourStart: '', happyHourEnd: '' });
    setShowDrawer(true);
  };

  const openEdit = (d: Discount) => {
    setEditTarget(d);
    setForm({
      code: d.couponCode ?? '', name: d.name, type: d.type, scope: d.scope,
      value: String(d.value), minOrderValue: '', maxDiscount: '',
      validFrom: d.startDate?.split('T')[0] ?? '', validTo: d.endDate?.split('T')[0] ?? '',
      happyHourStart: '', happyHourEnd: '',
    });
    setShowDrawer(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        type: form.type,
        scope: form.scope,
        value: parseFloat(form.value),
        code: form.code || undefined,
        minOrderValue: form.minOrderValue ? parseFloat(form.minOrderValue) : undefined,
        maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : undefined,
        validFrom: form.validFrom || undefined,
        validTo: form.validTo || undefined,
        happyHourStart: form.happyHourStart || undefined,
        happyHourEnd: form.happyHourEnd || undefined,
      };

      if (editTarget) {
        await discountApi.update(editTarget.id, payload);
      } else {
        await discountApi.create(payload);
      }
      await fetchDiscounts();
      setShowDrawer(false);
    } catch {
      // handle
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await discountApi.remove(id);
    setDiscounts((d) => d.filter((x) => x.id !== id));
  };

  const handleToggle = async (d: Discount) => {
    await discountApi.update(d.id, { isActive: !d.isActive });
    setDiscounts((prev) => prev.map((x) => x.id === d.id ? { ...x, isActive: !d.isActive } : x));
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white";

  const isExpired = (d: Discount) => d.endDate ? new Date(d.endDate) < new Date() : false;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 anim-fade-up">
        <div>
          <h1 className="font-display font-bold text-slate-900 text-2xl">Discounts</h1>
          <p className="text-slate-500 text-sm mt-0.5">{discounts.filter((d) => d.isActive).length} active codes</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-display text-white hover:brightness-95"
          style={{ background: 'var(--accent)' }}
        >
          <PlusIcon className="w-4 h-4" /> Create Discount
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : discounts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 text-slate-400">
          <TagIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-display text-sm">No discounts yet</p>
          <button onClick={openCreate} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold font-display text-white hover:brightness-95" style={{ background: 'var(--accent)' }}>
            Create your first discount
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {discounts.map((d, i) => {
            const expired = isExpired(d);
            return (
              <div
                key={d.id}
                className={`bg-white rounded-2xl border shadow-sm p-5 flex items-center gap-5 anim-fade-up ${expired ? 'border-slate-100 opacity-70' : 'border-slate-100'}`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${d.isActive && !expired ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}
                >
                  <TagIcon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-display font-semibold text-slate-800">{d.name}</p>
                    {d.couponCode && (
                      <code className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-mono">{d.couponCode}</code>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-display font-medium ${
                      expired ? 'bg-rose-100 text-rose-600' : d.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {expired ? 'Expired' : d.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {d.type === 'PERCENTAGE' ? `${d.value}% off` : `₹${d.value} off`}
                    </span>
                    {' · '}{d.scope} scope
                    {d.maxUsageTotal && ` · ${d.usageCount}/${d.maxUsageTotal} used`}
                    {d.endDate && ` · Expires ${new Date(d.endDate).toLocaleDateString('en-IN')}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => handleToggle(d)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-display transition-colors ${d.isActive ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                    {d.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    <EditIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Drawer */}
      <Drawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        title={editTarget ? 'Edit Discount' : 'Create Discount'}
        footer={
          <>
            <button onClick={() => setShowDrawer(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name || !form.value} className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:brightness-95" style={{ background: 'var(--accent)' }}>
              {saving ? 'Saving...' : editTarget ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Discount Name *</label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Happy Hour Special" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Coupon Code</label>
              <input type="text" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="HAPPY10" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Type</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputClass}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Value *</label>
              <input type="number" value={form.value} onChange={(e) => set('value', e.target.value)} placeholder={form.type === 'PERCENTAGE' ? '10' : '50'} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Scope</label>
              <select value={form.scope} onChange={(e) => set('scope', e.target.value)} className={inputClass}>
                <option value="BILL">Bill</option>
                <option value="ITEM">Item</option>
                <option value="CATEGORY">Category</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Min. Order (₹)</label>
              <input type="number" value={form.minOrderValue} onChange={(e) => set('minOrderValue', e.target.value)} placeholder="200" className={inputClass} />
            </div>
            {form.type === 'PERCENTAGE' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Max Discount (₹)</label>
                <input type="number" value={form.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} placeholder="500" className={inputClass} />
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-700 font-display mb-3">Validity Period</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-display">From</label>
                <input type="date" value={form.validFrom} onChange={(e) => set('validFrom', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-display">To</label>
                <input type="date" value={form.validTo} onChange={(e) => set('validTo', e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-700 font-display mb-3">Happy Hour (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-display">Start Time</label>
                <input type="time" value={form.happyHourStart} onChange={(e) => set('happyHourStart', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-display">End Time</label>
                <input type="time" value={form.happyHourEnd} onChange={(e) => set('happyHourEnd', e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
