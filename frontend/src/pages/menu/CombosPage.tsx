import { useEffect, useState } from 'react';
import { comboApi, menuApi } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import { PlusIcon, EditIcon, TrashIcon } from '../../components/ui/Icons';

interface ComboEntry {
  menuItemId: string;
  quantity: number;
  itemName?: string;
}

interface ComboItem {
  id: string;
  name: string;
  price: number;
  description: string | null;
  isActive: boolean;
  entries: (ComboEntry & { id: string })[];
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: { name: string };
}

export default function CombosPage() {
  const [combos, setCombos] = useState<ComboItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ComboItem | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [form, setForm] = useState({ name: '', price: '', description: '' });
  const [entries, setEntries] = useState<{ menuItemId: string; quantity: number }[]>([{ menuItemId: '', quantity: 1 }]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [combosRes, menuRes] = await Promise.all([
        comboApi.list(),
        menuApi.getAll(),
      ]);
      setCombos(combosRes.data ?? []);
      setMenuItems(menuRes.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', price: '', description: '' });
    setEntries([{ menuItemId: '', quantity: 1 }]);
    setError('');
    setShowModal(true);
  };

  const openEdit = (combo: ComboItem) => {
    setEditing(combo);
    setForm({ name: combo.name, price: String(combo.price), description: combo.description ?? '' });
    setEntries(combo.entries.map((e) => ({ menuItemId: e.menuItemId, quantity: e.quantity })));
    setError('');
    setShowModal(true);
  };

  const addEntry = () => setEntries((prev) => [...prev, { menuItemId: '', quantity: 1 }]);
  const removeEntry = (i: number) => setEntries((prev) => prev.filter((_, idx) => idx !== i));
  const updateEntry = (i: number, field: 'menuItemId' | 'quantity', val: any) =>
    setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) { setError('Name and price are required.'); return; }
    if (entries.some((e) => !e.menuItemId)) { setError('Select a menu item for each entry.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        price: parseFloat(form.price),
        description: form.description.trim() || undefined,
        entries,
      };
      if (editing) {
        await comboApi.update(editing.id, payload);
      } else {
        await comboApi.create(payload);
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (combo: ComboItem) => {
    try {
      await comboApi.update(combo.id, { isActive: !combo.isActive });
      setCombos((prev) => prev.map((c) => c.id === combo.id ? { ...c, isActive: !c.isActive } : c));
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await comboApi.remove(id);
      setCombos((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const getItemName = (id: string) => menuItems.find((m) => m.id === id)?.name ?? 'Unknown item';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 anim-fade-up">
        <div>
          <h1 className="font-display font-bold text-slate-900 text-2xl">Combo Items</h1>
          <p className="text-slate-500 text-sm mt-0.5">Bundle menu items into fixed-price combos</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-display text-white hover:brightness-95"
          style={{ background: 'var(--accent)' }}
        >
          <PlusIcon className="w-4 h-4" /> New Combo
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      ) : combos.length === 0 ? (
        <div className="text-center py-20 anim-fade-up">
          <p className="text-4xl mb-3">🍱</p>
          <p className="font-display font-semibold text-slate-700 text-lg">No combos yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-5">Create your first combo — e.g. "Lunch Special: Dal + Roti + Salad for ₹149"</p>
          <button
            onClick={openCreate}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold font-display text-white hover:brightness-95"
            style={{ background: 'var(--accent)' }}
          >
            Create First Combo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {combos.map((combo) => (
            <div
              key={combo.id}
              className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${combo.isActive ? 'border-slate-100' : 'border-dashed border-slate-200 opacity-60'}`}
            >
              {/* Title row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-bold text-slate-800 text-lg truncate">{combo.name}</p>
                    {!combo.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-display font-medium flex-shrink-0">Inactive</span>
                    )}
                  </div>
                  {combo.description && <p className="text-sm text-slate-400 mt-0.5 truncate">{combo.description}</p>}
                </div>
                <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                  <button
                    onClick={() => openEdit(combo)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <EditIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(combo.id)}
                    disabled={deleting === combo.id}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Price */}
              <p className="font-display font-bold text-red-600 text-xl mb-3">
                ₹{Number(combo.price).toLocaleString('en-IN')}
              </p>

              {/* Entries */}
              <div className="space-y-1.5">
                {combo.entries.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {entry.quantity}
                    </span>
                    <span className="text-slate-600 truncate">{getItemName(entry.menuItemId)}</span>
                  </div>
                ))}
              </div>

              {/* Toggle */}
              <button
                onClick={() => handleToggle(combo)}
                className={`mt-4 w-full py-1.5 rounded-lg text-xs font-display font-medium transition-colors ${
                  combo.isActive
                    ? 'text-slate-500 hover:text-rose-500 hover:bg-rose-50'
                    : 'text-emerald-600 hover:bg-emerald-50'
                }`}
              >
                {combo.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Combo' : 'New Combo Item'}
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:brightness-95"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Combo'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="px-3 py-2.5 bg-rose-50 rounded-xl border border-rose-200 text-sm text-rose-700">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1 font-display">Combo Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Lunch Special, Family Combo"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 font-display">Price (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 font-display">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Entries */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500 font-display">Included Items</label>
              <button
                onClick={addEntry}
                className="text-xs text-red-600 hover:underline font-display font-medium"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-2">
              {entries.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={entry.menuItemId}
                    onChange={(e) => updateEntry(i, 'menuItemId', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Select menu item…</option>
                    {menuItems.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs text-slate-400">×</span>
                    <input
                      type="number"
                      min="1"
                      value={entry.quantity}
                      onChange={(e) => updateEntry(i, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-14 px-2 py-2 rounded-xl border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  {entries.length > 1 && (
                    <button
                      onClick={() => removeEntry(i)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
