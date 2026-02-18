import React, { useEffect, useState } from 'react';
import { ingredientApi } from '../../lib/api';
import toast from 'react-hot-toast';

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  minStockLevel: number | null;
  yieldPercent: number;
  isActive: boolean;
  stock?: { branchId: string; currentQuantity: number }[];
}

const UNITS = ['KG', 'GRAM', 'LITRE', 'ML', 'PIECE', 'PACKET', 'BOX', 'DOZEN'];

export default function IngredientsPage() {
  const [ingredients, setIngredients]   = useState<Ingredient[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState<Ingredient | null>(null);
  const [search, setSearch]             = useState('');
  const [form, setForm] = useState({
    name: '', unit: 'KG', minStockLevel: '', yieldPercent: '100',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await ingredientApi.list();
      setIngredients(res.data);
    } catch {
      toast.error('Failed to load ingredients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', unit: 'KG', minStockLevel: '', yieldPercent: '100' });
    setShowModal(true);
  };

  const openEdit = (ing: Ingredient) => {
    setEditing(ing);
    setForm({
      name:          ing.name,
      unit:          ing.unit,
      minStockLevel: ing.minStockLevel?.toString() ?? '',
      yieldPercent:  ing.yieldPercent.toString(),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    try {
      const payload = {
        name:          form.name.trim(),
        unit:          form.unit,
        minStockLevel: form.minStockLevel ? parseFloat(form.minStockLevel) : undefined,
        yieldPercent:  parseFloat(form.yieldPercent) || 100,
      };
      if (editing) {
        await ingredientApi.update(editing.id, payload);
        toast.success('Ingredient updated');
      } else {
        await ingredientApi.create(payload);
        toast.success('Ingredient created');
      }
      setShowModal(false);
      load();
    } catch {
      toast.error('Failed to save ingredient');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this ingredient?')) return;
    try {
      await ingredientApi.delete(id);
      toast.success('Ingredient deactivated');
      load();
    } catch {
      toast.error('Failed to deactivate');
    }
  };

  const filtered = ingredients.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ingredients</h1>
          <p className="text-sm text-slate-500 mt-1">
            Raw materials used in recipes
          </p>
        </div>
        <button
          onClick={openNew}
          className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-4 py-2 rounded-xl text-sm"
        >
          + Add Ingredient
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search ingredients..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 border border-slate-200 rounded-xl px-4 py-2 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
      />

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Ingredient', 'Unit', 'Min Stock', 'Yield %', 'Current Stock', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    No ingredients found
                  </td>
                </tr>
              ) : (
                filtered.map((ing) => {
                  const currentStock = ing.stock?.reduce(
                    (s, b) => s + Number(b.currentQuantity), 0,
                  ) ?? 0;
                  const isLow = ing.minStockLevel !== null
                    && currentStock <= Number(ing.minStockLevel);
                  return (
                    <tr key={ing.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{ing.name}</td>
                      <td className="px-4 py-3 text-slate-500">{ing.unit}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {ing.minStockLevel ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{ing.yieldPercent}%</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-slate-700'}`}>
                          {currentStock.toFixed(2)} {ing.unit}
                        </span>
                        {isLow && (
                          <span className="ml-2 text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
                            Low
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(ing)}
                          className="text-slate-500 hover:text-slate-800 text-xs mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(ing.id)}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              {editing ? 'Edit Ingredient' : 'New Ingredient'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="e.g. Tomato, Chicken Breast"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                    Unit *
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                    Yield %
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.yieldPercent}
                    onChange={(e) => setForm({ ...form, yieldPercent: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                  Min Stock Level (alert threshold)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.minStockLevel}
                  onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Optional — e.g. 2.5"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-black rounded-xl py-2 text-sm font-semibold"
              >
                {editing ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
