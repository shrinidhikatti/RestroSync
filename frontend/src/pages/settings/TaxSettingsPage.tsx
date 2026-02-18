import React, { useEffect, useState } from 'react';
import { taxApi, restaurantApi } from '../../lib/api';
import { Toggle } from '../../components/ui/Toggle';
import { Modal } from '../../components/ui/Modal';
import { PlusIcon, TrashIcon, EditIcon } from '../../components/ui/Icons';

interface TaxComponent { id: string; type: string; rate: number; name: string; }
interface TaxGroup { id: string; name: string; isActive: boolean; components: TaxComponent[]; }
interface ChargeConfig { id: string; name: string; type: string; value: number; isActive: boolean; applicableTo: string; }

const COMPONENT_TYPES = ['CGST','SGST','IGST','VAT','CESS'];

export default function TaxSettingsPage() {
  const [taxGroups, setTaxGroups] = useState<TaxGroup[]>([]);
  const [charges, setCharges] = useState<ChargeConfig[]>([]);
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [editGroup, setEditGroup] = useState<TaxGroup | null>(null);
  const [taxForm, setTaxForm] = useState({ name: '', components: [{ type: 'CGST', rate: '9' }] });
  const [chargeForm, setChargeForm] = useState({ name: '', type: 'PERCENTAGE', value: '10', dineInOnly: false });
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    try {
      const [tgRes, chRes, restRes] = await Promise.all([
        taxApi.getGroups(),
        taxApi.getCharges(),
        restaurantApi.getMe(),
      ]);
      setTaxGroups(tgRes.data);
      setCharges(chRes.data);
      setTaxInclusive(restRes.data.taxInclusive ?? false);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleTaxInclusive = async (v: boolean) => {
    setTaxInclusive(v);
    await taxApi.updateSettings(v);
  };

  const openEditGroup = (g: TaxGroup) => {
    setEditGroup(g);
    setTaxForm({ name: g.name, components: g.components.map((c) => ({ type: c.type, rate: String(c.rate) })) });
    setShowTaxModal(true);
  };

  const handleSaveTaxGroup = async () => {
    setSaving(true);
    try {
      const payload = {
        name: taxForm.name,
        components: taxForm.components.map((c) => ({ type: c.type as any, rate: parseFloat(c.rate) })),
      };
      if (editGroup) {
        await taxApi.updateGroup(editGroup.id, payload);
      } else {
        await taxApi.createGroup(payload);
      }
      await fetchAll();
      setShowTaxModal(false);
      setEditGroup(null);
      setTaxForm({ name: '', components: [{ type: 'CGST', rate: '9' }] });
    } catch {
      // handle
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    await taxApi.deleteGroup(id);
    await fetchAll();
  };

  const handleSaveCharge = async () => {
    setSaving(true);
    try {
      await taxApi.createCharge({
        name: chargeForm.name,
        type: chargeForm.type,
        value: parseFloat(chargeForm.value),
        dineInOnly: chargeForm.dineInOnly,
      });
      await fetchAll();
      setShowChargeModal(false);
      setChargeForm({ name: '', type: 'PERCENTAGE', value: '10', dineInOnly: false });
    } finally {
      setSaving(false);
    }
  };

  const toggleCharge = async (c: ChargeConfig) => {
    await taxApi.updateCharge(c.id, { isActive: !c.isActive });
    setCharges((prev) => prev.map((ch) => ch.id === c.id ? { ...ch, isActive: !c.isActive } : ch));
  };

  const addComponent = () => setTaxForm((f) => ({ ...f, components: [...f.components, { type: 'SGST', rate: '9' }] }));
  const removeComponent = (i: number) => setTaxForm((f) => ({ ...f, components: f.components.filter((_, idx) => idx !== i) }));
  const updateComponent = (i: number, k: string, v: string) => setTaxForm((f) => ({
    ...f,
    components: f.components.map((c, idx) => idx === i ? { ...c, [k]: v } : c),
  }));

  const sectionCard = "bg-white rounded-2xl border border-slate-100 shadow-sm";

  if (loading) return <div className="p-6"><div className="skeleton h-64 rounded-2xl" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="anim-fade-up">
        <h1 className="font-display font-bold text-slate-900 text-2xl">Tax & Charges</h1>
        <p className="text-slate-500 text-sm mt-0.5">Configure GST groups, service charges, and tax settings</p>
      </div>

      {/* Tax Inclusive toggle */}
      <div className={`${sectionCard} p-5 anim-fade-up delay-50`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display font-semibold text-slate-800">Tax-Inclusive Pricing</p>
            <p className="text-sm text-slate-500 mt-0.5">Menu prices already include tax (tax will not be added at billing)</p>
          </div>
          <Toggle checked={taxInclusive} onChange={handleTaxInclusive} />
        </div>
      </div>

      {/* Tax Groups */}
      <div className={`${sectionCard} overflow-hidden anim-fade-up delay-100`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-display font-semibold text-slate-800">Tax Groups</h2>
          <button
            onClick={() => { setEditGroup(null); setTaxForm({ name: '', components: [{ type: 'CGST', rate: '9' }] }); setShowTaxModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold font-display text-slate-900 hover:brightness-95"
            style={{ background: 'var(--accent)' }}
          >
            <PlusIcon className="w-3.5 h-3.5" /> Add Group
          </button>
        </div>

        {taxGroups.length === 0 ? (
          <p className="text-center py-10 text-slate-400 text-sm font-display">No tax groups yet</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {taxGroups.map((g) => (
              <div key={g.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-slate-800">{g.name}</p>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {g.components.map((c) => (
                      <span key={c.id} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-display font-medium">
                        {c.type} {c.rate}%
                      </span>
                    ))}
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-display font-semibold">
                      Total: {g.components.reduce((s, c) => s + c.rate, 0)}%
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditGroup(g)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    <EditIcon className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteGroup(g.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Charges */}
      <div className={`${sectionCard} overflow-hidden anim-fade-up delay-150`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-display font-semibold text-slate-800">Service Charges</h2>
          <button
            onClick={() => setShowChargeModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold font-display text-slate-900 hover:brightness-95"
            style={{ background: 'var(--accent)' }}
          >
            <PlusIcon className="w-3.5 h-3.5" /> Add Charge
          </button>
        </div>

        {charges.length === 0 ? (
          <p className="text-center py-10 text-slate-400 text-sm font-display">No charges configured</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {charges.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1">
                  <p className="font-display font-semibold text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {c.type === 'PERCENTAGE' ? `${c.value}%` : `₹${c.value} flat`}
                    {' · '}{c.applicableTo === 'DINE_IN' ? 'Dine-in only' : 'All orders'}
                  </p>
                </div>
                <Toggle checked={c.isActive} onChange={() => toggleCharge(c)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tax Group Modal */}
      <Modal
        open={showTaxModal}
        onClose={() => { setShowTaxModal(false); setEditGroup(null); }}
        title={editGroup ? 'Edit Tax Group' : 'New Tax Group'}
        footer={
          <>
            <button onClick={() => setShowTaxModal(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Cancel</button>
            <button onClick={handleSaveTaxGroup} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-900 disabled:opacity-60 hover:brightness-95" style={{ background: 'var(--accent)' }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Group Name</label>
            <input type="text" value={taxForm.name} onChange={(e) => setTaxForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. GST 5%" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 font-display">Components</label>
              <button type="button" onClick={addComponent} className="text-xs text-amber-600 hover:underline font-display">+ Add component</button>
            </div>
            <div className="space-y-2">
              {taxForm.components.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={c.type} onChange={(e) => updateComponent(i, 'type', e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                    {COMPONENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="flex items-center gap-1 w-24">
                    <input type="number" value={c.rate} onChange={(e) => updateComponent(i, 'rate', e.target.value)} min="0" max="100" step="0.5" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                  {taxForm.components.length > 1 && (
                    <button type="button" onClick={() => removeComponent(i)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition-colors">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100 text-sm text-amber-700 font-display font-semibold">
              Total: {taxForm.components.reduce((s, c) => s + (parseFloat(c.rate) || 0), 0)}%
            </div>
          </div>
        </div>
      </Modal>

      {/* Charge Modal */}
      <Modal
        open={showChargeModal}
        onClose={() => setShowChargeModal(false)}
        title="New Charge"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowChargeModal(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Cancel</button>
            <button onClick={handleSaveCharge} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-900 disabled:opacity-60 hover:brightness-95" style={{ background: 'var(--accent)' }}>
              {saving ? 'Saving...' : 'Create'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Name</label>
            <input type="text" value={chargeForm.name} onChange={(e) => setChargeForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Service Charge" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Type</label>
              <select value={chargeForm.type} onChange={(e) => setChargeForm((f) => ({ ...f, type: e.target.value }))} className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                <option value="PERCENTAGE">Percentage</option>
                <option value="FLAT">Flat amount</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Value</label>
              <input type="number" value={chargeForm.value} onChange={(e) => setChargeForm((f) => ({ ...f, value: e.target.value }))} className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
          <Toggle checked={chargeForm.dineInOnly} onChange={(v) => setChargeForm((f) => ({ ...f, dineInOnly: v }))} label="Dine-in orders only" />
        </div>
      </Modal>
    </div>
  );
}
