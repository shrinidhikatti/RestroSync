import React, { useEffect, useState } from 'react';
import { categoryApi } from '../../lib/api';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { PlusIcon, EditIcon, TrashIcon } from '../../components/ui/Icons';

interface Category {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { menuItems: number };
}

const COLORS = ['#ef4444','#f97316','#f59e0b','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#64748b'];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', color: '#f59e0b' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchCategories = async () => {
    try {
      const res = await categoryApi.getAll();
      setCategories(res.data);
    } catch {
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const openEdit = (cat: Category) => {
    setEditTarget(cat);
    setForm({ name: cat.name, color: cat.color ?? '#f59e0b' });
    setShowAdd(true);
  };

  const handleClose = () => {
    setShowAdd(false);
    setEditTarget(null);
    setForm({ name: '', color: '#f59e0b' });
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editTarget) {
        await categoryApi.update(editTarget.id, { name: form.name, color: form.color });
      } else {
        await categoryApi.create({ name: form.name, color: form.color });
      }
      await fetchCategories();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.userMessage ?? 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await categoryApi.remove(deleteTarget.id);
      await fetchCategories();
      setDeleteTarget(null);
    } catch (err: any) {
      setError(err.response?.data?.userMessage ?? 'Failed to delete category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 anim-fade-up">
        <div>
          <h1 className="font-display font-bold text-slate-900 text-2xl">Menu Categories</h1>
          <p className="text-slate-500 text-sm mt-0.5">{categories.length} categories configured</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-display text-slate-900 hover:brightness-95 transition-all"
          style={{ background: 'var(--accent)' }}
        >
          <PlusIcon className="w-4 h-4" /> Add Category
        </button>
      </div>

      {error && !showAdd && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm">{error}</div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat, i) => (
            <div
              key={cat.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4 anim-fade-up group"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Color swatch */}
              <div
                className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-display font-bold text-lg"
                style={{ background: cat.color ?? '#94a3b8' }}
              >
                {cat.name.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-slate-900 truncate">{cat.name}</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {cat._count?.menuItems ?? 0} items
                  {!cat.isActive && <span className="ml-2 text-rose-400">· inactive</span>}
                </p>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(cat)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <EditIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget(cat)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {categories.length === 0 && (
            <div className="col-span-3 text-center py-16 text-slate-400">
              <p className="font-display text-sm">No categories yet.</p>
              <p className="text-xs mt-1">Add your first category to organize the menu.</p>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={showAdd}
        onClose={handleClose}
        title={editTarget ? 'Edit Category' : 'New Category'}
        size="sm"
        footer={
          <>
            <button onClick={handleClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-900 disabled:opacity-60 hover:brightness-95 transition-colors"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? 'Saving...' : editTarget ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Starters, Main Course"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 font-display">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className="w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110"
                  style={{
                    background: c,
                    borderColor: form.color === c ? '#0f172a' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-display font-bold" style={{ background: form.color }}>
              {(form.name || 'A').charAt(0).toUpperCase()}
            </div>
            <span className="font-display font-semibold text-slate-800">{form.name || 'Category name'}</span>
          </div>

          {error && <p className="text-rose-500 text-sm">{error}</p>}
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        message={`Delete "${deleteTarget?.name}"? Items will be preserved but the category will be deactivated.`}
        confirmLabel="Delete"
        danger
        loading={saving}
      />
    </div>
  );
}
