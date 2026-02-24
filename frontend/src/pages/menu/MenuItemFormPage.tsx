import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { menuApi, categoryApi, taxApi } from '../../lib/api';
import { FoodTypeDot } from '../../components/ui/FoodTypeDot';
import { PlusIcon, TrashIcon } from '../../components/ui/Icons';

const FOOD_TYPES = ['VEG', 'NON_VEG', 'EGG'];
const STATIONS = ['KITCHEN', 'BAR', 'DESSERT'];

export default function MenuItemFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id && id !== 'new';

  const [form, setForm] = useState({
    name: '', shortName: '', description: '',
    price: '', categoryId: '', foodType: 'VEG',
    kitchenStation: 'KITCHEN', taxGroupId: '', barcode: '',
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [taxGroups, setTaxGroups] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [newVariant, setNewVariant] = useState({ name: '', price: '' });
  const [newAddon, setNewAddon] = useState({ name: '', price: '' });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const init = async () => {
      const [catRes, taxRes] = await Promise.all([
        categoryApi.getAll(),
        taxApi.getGroups(),
      ]);
      setCategories(catRes.data);
      setTaxGroups(taxRes.data);

      if (isEdit) {
        try {
          const res = await menuApi.getOne(id!);
          const item = res.data;
          setForm({
            name: item.name, shortName: item.shortName ?? '',
            description: item.description ?? '', price: String(item.price),
            categoryId: item.categoryId, foodType: item.foodType ?? 'VEG',
            kitchenStation: item.kitchenStation ?? 'KITCHEN',
            taxGroupId: item.taxGroupId ?? '', barcode: item.barcode ?? '',
          });
          setVariants(item.variants ?? []);
          setAddons(item.addons ?? []);
        } catch {
          setError('Item not found');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    init();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId) { setError('Please select a category'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        taxGroupId: form.taxGroupId || undefined,
        barcode: form.barcode || undefined,
        shortName: form.shortName || undefined,
      };
      if (isEdit) {
        await menuApi.update(id!, payload);
      } else {
        await menuApi.create(payload);
      }
      navigate('/menu/items');
    } catch (err: any) {
      setError(err.response?.data?.userMessage ?? 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const addVariant = async () => {
    if (!newVariant.name || !newVariant.price) return;
    if (isEdit) {
      const res = await menuApi.createVariant(id!, { name: newVariant.name, price: parseFloat(newVariant.price) });
      setVariants((v) => [...v, res.data]);
    } else {
      setVariants((v) => [...v, { id: Date.now().toString(), ...newVariant }]);
    }
    setNewVariant({ name: '', price: '' });
  };

  const removeVariant = async (variantId: string) => {
    if (isEdit) await menuApi.deleteVariant(id!, variantId);
    setVariants((v) => v.filter((i) => i.id !== variantId));
  };

  const addAddon = async () => {
    if (!newAddon.name || !newAddon.price) return;
    if (isEdit) {
      const res = await menuApi.createAddon(id!, { name: newAddon.name, price: parseFloat(newAddon.price) });
      setAddons((a) => [...a, res.data]);
    } else {
      setAddons((a) => [...a, { id: Date.now().toString(), ...newAddon }]);
    }
    setNewAddon({ name: '', price: '' });
  };

  const removeAddon = async (addonId: string) => {
    if (isEdit) await menuApi.deleteAddon(id!, addonId);
    setAddons((a) => a.filter((i) => i.id !== addonId));
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white";

  if (loading) return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      {[1,2,3,4].map((i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 anim-fade-up">
        <h1 className="font-display font-bold text-slate-900 text-2xl">
          {isEdit ? 'Edit Menu Item' : 'New Menu Item'}
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Fill in the details for this dish</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 anim-fade-up delay-50">
          <h2 className="font-display font-semibold text-slate-800 mb-4">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Item Name *</label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="e.g. Paneer Tikka" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Short Name</label>
              <input type="text" value={form.shortName} onChange={(e) => set('shortName', e.target.value)} placeholder="e.g. P.Tikka" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Price (₹) *</label>
              <input type="number" value={form.price} onChange={(e) => set('price', e.target.value)} required min="0" step="0.01" placeholder="0.00" className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Description</label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="Brief description of the dish" className={inputClass} />
            </div>
          </div>
        </div>

        {/* Classification card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 anim-fade-up delay-100">
          <h2 className="font-display font-semibold text-slate-800 mb-4">Classification</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Category *</label>
              <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} required className={inputClass}>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Kitchen Station</label>
              <select value={form.kitchenStation} onChange={(e) => set('kitchenStation', e.target.value)} className={inputClass}>
                {STATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Tax Group</label>
              <select value={form.taxGroupId} onChange={(e) => set('taxGroupId', e.target.value)} className={inputClass}>
                <option value="">No tax</option>
                {taxGroups.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Barcode</label>
              <input type="text" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="Optional barcode" className={inputClass} />
            </div>
          </div>

          {/* Food type */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-2 font-display">Food Type</label>
            <div className="flex gap-3">
              {FOOD_TYPES.map((ft) => (
                <button
                  key={ft}
                  type="button"
                  onClick={() => set('foodType', ft)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium font-display transition-all ${
                    form.foodType === ft
                      ? 'border-slate-800 bg-slate-50 text-slate-800'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <FoodTypeDot type={ft} />
                  {ft === 'NON_VEG' ? 'Non-Veg' : ft === 'VEG' ? 'Veg' : 'Egg'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Variants */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 anim-fade-up delay-150">
          <h2 className="font-display font-semibold text-slate-800 mb-4">Variants <span className="text-slate-400 font-normal text-sm">(optional)</span></h2>
          <div className="space-y-2 mb-3">
            {variants.map((v) => (
              <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                <span className="flex-1 text-sm font-medium text-slate-700">{v.name}</span>
                <span className="text-sm text-slate-500 font-display">₹{v.price}</span>
                <button type="button" onClick={() => removeVariant(v.id)} className="p-1 rounded text-slate-400 hover:text-rose-500 transition-colors">
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newVariant.name} onChange={(e) => setNewVariant((v) => ({ ...v, name: e.target.value }))} placeholder="Variant name (e.g. Half)" className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            <input type="number" value={newVariant.price} onChange={(e) => setNewVariant((v) => ({ ...v, price: e.target.value }))} placeholder="Price" className="w-28 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            <button type="button" onClick={addVariant} className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Addons */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 anim-fade-up delay-200">
          <h2 className="font-display font-semibold text-slate-800 mb-4">Add-ons <span className="text-slate-400 font-normal text-sm">(optional)</span></h2>
          <div className="space-y-2 mb-3">
            {addons.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                <span className="flex-1 text-sm font-medium text-slate-700">{a.name}</span>
                <span className="text-sm text-slate-500 font-display">+₹{a.price}</span>
                <button type="button" onClick={() => removeAddon(a.id)} className="p-1 rounded text-slate-400 hover:text-rose-500 transition-colors">
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newAddon.name} onChange={(e) => setNewAddon((a) => ({ ...a, name: e.target.value }))} placeholder="Add-on name (e.g. Extra Cheese)" className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            <input type="number" value={newAddon.price} onChange={(e) => setNewAddon((a) => ({ ...a, price: e.target.value }))} placeholder="Price" className="w-28 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            <button type="button" onClick={addAddon} className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && <p className="text-rose-500 text-sm p-3 bg-rose-50 rounded-xl border border-rose-100">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-6">
          <button type="button" onClick={() => navigate('/menu/items')} className="px-5 py-2.5 rounded-xl text-sm font-semibold font-display text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl text-sm font-semibold font-display text-white hover:brightness-95 disabled:opacity-60 transition-all" style={{ background: 'var(--accent)' }}>
            {saving ? 'Saving...' : isEdit ? 'Update Item' : 'Create Item'}
          </button>
        </div>
      </form>
    </div>
  );
}
