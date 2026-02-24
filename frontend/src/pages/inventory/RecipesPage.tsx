import React, { useEffect, useState } from 'react';
import { recipeApi, ingredientApi, menuApi } from '../../lib/api';
import toast from 'react-hot-toast';

interface RecipeIngredient {
  id: string;
  ingredientId: string | null;
  subRecipeId: string | null;
  quantity: number;
  unit: string;
  ingredient?: { id: string; name: string; unit: string } | null;
}

interface Recipe {
  id: string;
  name: string;
  isSubRecipe: boolean;
  menuItemId: string | null;
  yieldQuantity: number | null;
  yieldUnit: string | null;
  menuItem?: { id: string; name: string } | null;
  ingredients: RecipeIngredient[];
}

export default function RecipesPage() {
  const [recipes, setRecipes]         = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [menuItems, setMenuItems]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState<Recipe | null>(null);
  const [selected, setSelected]       = useState<Recipe | null>(null);

  const [form, setForm] = useState({
    name: '', menuItemId: '', isSubRecipe: false,
    yieldQuantity: '', yieldUnit: '',
  });
  const [formIngredients, setFormIngredients] = useState<
    { ingredientId: string; quantity: string; unit: string }[]
  >([{ ingredientId: '', quantity: '', unit: '' }]);

  const load = async () => {
    setLoading(true);
    try {
      const [r, i, m] = await Promise.all([
        recipeApi.list(),
        ingredientApi.list(),
        menuApi.getAll(),
      ]);
      setRecipes(r.data);
      setIngredients(i.data);
      setMenuItems(m.data?.data ?? m.data ?? []);
    } catch {
      toast.error('Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', menuItemId: '', isSubRecipe: false, yieldQuantity: '', yieldUnit: '' });
    setFormIngredients([{ ingredientId: '', quantity: '', unit: '' }]);
    setShowModal(true);
  };

  const openEdit = (r: Recipe) => {
    setEditing(r);
    setForm({
      name:          r.name,
      menuItemId:    r.menuItemId ?? '',
      isSubRecipe:   r.isSubRecipe,
      yieldQuantity: r.yieldQuantity?.toString() ?? '',
      yieldUnit:     r.yieldUnit ?? '',
    });
    setFormIngredients(
      r.ingredients.map((ri) => ({
        ingredientId: ri.ingredientId ?? '',
        quantity:     ri.quantity.toString(),
        unit:         ri.unit,
      })),
    );
    setShowModal(true);
  };

  const addIngRow = () =>
    setFormIngredients([...formIngredients, { ingredientId: '', quantity: '', unit: '' }]);

  const removeIngRow = (i: number) =>
    setFormIngredients(formIngredients.filter((_, idx) => idx !== i));

  const updateIngRow = (i: number, field: string, val: string) => {
    const updated = [...formIngredients];
    (updated[i] as any)[field] = val;
    // Auto-fill unit from ingredient
    if (field === 'ingredientId') {
      const ing = ingredients.find((x) => x.id === val);
      if (ing) updated[i].unit = ing.unit;
    }
    setFormIngredients(updated);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Recipe name required'); return; }
    const validIngs = formIngredients.filter((i) => i.ingredientId && i.quantity);
    if (validIngs.length === 0) { toast.error('Add at least one ingredient'); return; }

    try {
      const payload = {
        name:          form.name,
        menuItemId:    form.menuItemId || undefined,
        isSubRecipe:   form.isSubRecipe,
        yieldQuantity: form.yieldQuantity ? parseFloat(form.yieldQuantity) : undefined,
        yieldUnit:     form.yieldUnit || undefined,
        ingredients:   validIngs.map((i) => ({
          ingredientId: i.ingredientId,
          quantity:     parseFloat(i.quantity),
          unit:         i.unit,
        })),
      };
      if (editing) {
        await recipeApi.update(editing.id, payload);
        toast.success('Recipe updated');
      } else {
        await recipeApi.create(payload);
        toast.success('Recipe created');
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to save recipe');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recipe?')) return;
    try {
      await recipeApi.delete(id);
      toast.success('Recipe deleted');
      if (selected?.id === id) setSelected(null);
      load();
    } catch {
      toast.error('Failed to delete recipe');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recipes</h1>
          <p className="text-sm text-slate-500 mt-1">Map menu items to ingredients for stock auto-deduction</p>
        </div>
        <button
          onClick={openNew}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-xl text-sm"
        >
          + New Recipe
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recipe list */}
          <div className="lg:col-span-1 space-y-2">
            {recipes.length === 0 ? (
              <div className="text-center py-12 text-slate-400">No recipes yet</div>
            ) : recipes.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelected(r)}
                className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-red-500 transition-colors ${
                  selected?.id === r.id ? 'border-red-500 bg-red-50' : 'border-slate-100'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">{r.name}</div>
                    {r.menuItem && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        → {r.menuItem.name}
                      </div>
                    )}
                    {r.isSubRecipe && (
                      <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded mt-1 inline-block">
                        Sub-recipe
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(r); }}
                      className="text-slate-500 hover:text-slate-800">Edit</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                      className="text-red-400 hover:text-red-600">Delete</button>
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  {r.ingredients.length} ingredient{r.ingredients.length !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>

          {/* Recipe detail */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
                  {selected.menuItem && (
                    <span className="text-sm text-slate-500">
                      For: <strong>{selected.menuItem.name}</strong>
                    </span>
                  )}
                </div>
                {selected.yieldQuantity && (
                  <div className="text-sm text-slate-500 mb-4">
                    Yield: {selected.yieldQuantity} {selected.yieldUnit}
                  </div>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ingredient</th>
                      <th className="text-right pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Quantity</th>
                      <th className="text-right pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {selected.ingredients.map((ri) => (
                      <tr key={ri.id}>
                        <td className="py-2">{ri.ingredient?.name ?? ri.ingredientId}</td>
                        <td className="py-2 text-right">{Number(ri.quantity).toFixed(3)}</td>
                        <td className="py-2 text-right text-slate-500">{ri.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                Select a recipe to view details
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 my-4">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Edit Recipe' : 'New Recipe'}</h2>
            <div className="space-y-3 mb-4">
              <div>
                <label className="label">Recipe Name *</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input" placeholder="e.g. Paneer Butter Masala" />
              </div>
              <div>
                <label className="label">Menu Item (optional)</label>
                <select value={form.menuItemId}
                  onChange={(e) => setForm({ ...form, menuItemId: e.target.value })}
                  className="input">
                  <option value="">None (sub-recipe)</option>
                  {menuItems.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="subrecipe" checked={form.isSubRecipe}
                  onChange={(e) => setForm({ ...form, isSubRecipe: e.target.checked })} />
                <label htmlFor="subrecipe" className="text-sm text-slate-600">This is a sub-recipe (used inside other recipes)</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Yield Qty</label>
                  <input type="number" value={form.yieldQuantity}
                    onChange={(e) => setForm({ ...form, yieldQuantity: e.target.value })}
                    className="input" placeholder="Optional" />
                </div>
                <div>
                  <label className="label">Yield Unit</label>
                  <input type="text" value={form.yieldUnit}
                    onChange={(e) => setForm({ ...form, yieldUnit: e.target.value })}
                    className="input" placeholder="e.g. PORTION" />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700">Ingredients</span>
                <button onClick={addIngRow}
                  className="text-xs text-red-600 font-semibold">+ Add Row</button>
              </div>
              <div className="space-y-2">
                {formIngredients.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select
                      value={row.ingredientId}
                      onChange={(e) => updateIngRow(i, 'ingredientId', e.target.value)}
                      className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                    >
                      <option value="">Select</option>
                      {ingredients.map((ing: any) => (
                        <option key={ing.id} value={ing.id}>{ing.name}</option>
                      ))}
                    </select>
                    <input type="number" min="0.001" step="0.001"
                      value={row.quantity}
                      onChange={(e) => updateIngRow(i, 'quantity', e.target.value)}
                      className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                      placeholder="Qty" />
                    <input type="text"
                      value={row.unit}
                      onChange={(e) => updateIngRow(i, 'unit', e.target.value)}
                      className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                      placeholder="Unit" />
                    <button onClick={() => removeIngRow(i)}
                      className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-semibold">Cancel</button>
              <button onClick={handleSave} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2 text-sm font-semibold">
                {editing ? 'Save Changes' : 'Create Recipe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
