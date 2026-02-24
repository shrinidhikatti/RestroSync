import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { menuApi, categoryApi } from '../../lib/api';
import { FoodTypeDot } from '../../components/ui/FoodTypeDot';
import { Toggle } from '../../components/ui/Toggle';
import { PlusIcon, EditIcon, TrashIcon, SearchIcon, FilterIcon } from '../../components/ui/Icons';
import { ConfirmModal } from '../../components/ui/Modal';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  foodType: string | null;
  kitchenStation: string | null;
  isAvailable: boolean;
  isArchived: boolean;
  category: { id: string; name: string; color: string | null };
  variants: any[];
  addons: any[];
}

interface Category { id: string; name: string; color: string | null; }

export default function MenuItemsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<MenuItem | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      const [itemsRes, catRes] = await Promise.all([
        menuApi.getAll(filterCategory || undefined),
        categoryApi.getAll(),
      ]);
      setItems(itemsRes.data);
      setCategories(catRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, [filterCategory]);

  const handleToggle = async (item: MenuItem) => {
    setTogglingId(item.id);
    try {
      await menuApi.toggleAvailability(item.id, !item.isAvailable);
      setItems((prev) =>
        prev.map((i) => i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i)
      );
    } catch {
      // ignore
    } finally {
      setTogglingId(null);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await menuApi.archive(archiveTarget.id);
      setItems((prev) => prev.filter((i) => i.id !== archiveTarget.id));
    } finally {
      setArchiveTarget(null);
    }
  };

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 anim-fade-up">
        <div>
          <h1 className="font-display font-bold text-slate-900 text-2xl">Menu Items</h1>
          <p className="text-slate-500 text-sm mt-0.5">{items.length} items</p>
        </div>
        <Link
          to="/menu/items/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-display text-white hover:brightness-95 transition-all"
          style={{ background: 'var(--accent)' }}
        >
          <PlusIcon className="w-4 h-4" /> Add Item
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 anim-fade-up delay-50">
        <div className="flex-1 relative max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-slate-700 font-display"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden anim-fade-up delay-100">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="skeleton w-10 h-10 rounded-xl" />
                <div className="skeleton flex-1 h-4" />
                <div className="skeleton w-20 h-4" />
                <div className="skeleton w-16 h-4" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="font-display text-sm">No items found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Item</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Station</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Price</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Available</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {item.foodType && <FoodTypeDot type={item.foodType} />}
                      <div>
                        <p className="font-medium text-slate-800">{item.name}</p>
                        {item.variants.length > 0 && (
                          <p className="text-xs text-slate-400">{item.variants.length} variant{item.variants.length > 1 ? 's' : ''}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-medium text-white font-display"
                      style={{ background: item.category.color ?? '#94a3b8' }}
                    >
                      {item.category.name}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-slate-500 text-xs font-display">{item.kitchenStation ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-display font-semibold text-slate-800">₹{Number(item.price).toLocaleString('en-IN')}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Toggle
                      checked={item.isAvailable}
                      onChange={() => handleToggle(item)}
                      disabled={togglingId === item.id}
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => navigate(`/menu/items/${item.id}`)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <EditIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setArchiveTarget(item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        title="Archive Item"
        message={`Archive "${archiveTarget?.name}"? It will be hidden from the menu but order history is preserved.`}
        confirmLabel="Archive"
        danger
      />
    </div>
  );
}
