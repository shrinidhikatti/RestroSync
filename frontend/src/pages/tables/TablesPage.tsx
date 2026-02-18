import React, { useEffect, useState } from 'react';
import { tableApi } from '../../lib/api';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { TableStatusBadge } from '../../components/ui/Badge';
import { PlusIcon, EditIcon, ClockIcon } from '../../components/ui/Icons';

interface Table {
  id: string;
  number: string;
  capacity: number;
  floor: string | null;
  section: string | null;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BILLING';
  occupiedSince: string | null;
  orders?: any[];
  reservations?: any[];
}

const statusConfig = {
  AVAILABLE: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  OCCUPIED:  { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    dot: 'bg-rose-500' },
  RESERVED:  { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  BILLING:   { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    dot: 'bg-blue-500' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTable, setEditTable] = useState<Table | null>(null);
  const [form, setForm] = useState({ number: '', capacity: '4', floor: '', section: '' });
  const [saving, setSaving] = useState(false);
  const [filterSection, setFilterSection] = useState('');

  const fetchTables = async () => {
    try {
      const res = await tableApi.getAll();
      setTables(res.data);
    } catch {
      // demo tables if API not ready
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTables(); }, []);

  const sections = [...new Set(tables.map((t) => t.section).filter(Boolean))] as string[];

  const filtered = filterSection
    ? tables.filter((t) => t.section === filterSection)
    : tables;

  const openEdit = (t: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTable(t);
    setForm({ number: t.number, capacity: String(t.capacity), floor: t.floor ?? '', section: t.section ?? '' });
    setShowAddModal(true);
  };

  const handleClose = () => {
    setShowAddModal(false);
    setEditTable(null);
    setForm({ number: '', capacity: '4', floor: '', section: '' });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { number: form.number, capacity: parseInt(form.capacity), floor: form.floor || undefined, section: form.section || undefined };
      if (editTable) {
        await tableApi.update(editTable.id, payload);
      } else {
        await tableApi.create(payload);
      }
      await fetchTables();
      handleClose();
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  // Group by section/floor
  const grouped: Record<string, Table[]> = {};
  filtered.forEach((t) => {
    const key = t.section ?? t.floor ?? 'Main Hall';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 anim-fade-up">
        <div>
          <h1 className="font-display font-bold text-slate-900 text-2xl">Floor Plan</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {tables.filter((t) => t.status === 'OCCUPIED').length} occupied ·{' '}
            {tables.filter((t) => t.status === 'AVAILABLE').length} available ·{' '}
            {tables.length} total
          </p>
        </div>
        <div className="flex gap-3">
          {sections.length > 0 && (
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none bg-white text-slate-700 font-display"
            >
              <option value="">All sections</option>
              {sections.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-display text-slate-900 hover:brightness-95"
            style={{ background: 'var(--accent)' }}
          >
            <PlusIcon className="w-4 h-4" /> Add Table
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-6 anim-fade-up delay-50">
        {Object.entries(statusConfig).map(([status, cfg]) => (
          <div key={status} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            <span className="text-xs text-slate-500 font-display">{status}</span>
          </div>
        ))}
      </div>

      {/* Table grid */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="font-display text-sm">No tables yet. Add your first table.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([section, sectionTables]) => (
            <div key={section} className="anim-fade-up">
              <h3 className="font-display font-semibold text-slate-700 text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="h-px flex-1 bg-slate-200" />
                {section}
                <span className="h-px flex-1 bg-slate-200" />
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                {sectionTables.map((table) => {
                  const cfg = statusConfig[table.status] ?? statusConfig.AVAILABLE;
                  const activeOrder = table.orders?.[0];
                  return (
                    <button
                      key={table.id}
                      onClick={() => setSelectedTable(table)}
                      className={`relative p-4 rounded-2xl border-2 ${cfg.bg} ${cfg.border} text-left transition-all hover:scale-[1.03] active:scale-[0.98] cursor-pointer shadow-sm group`}
                    >
                      {/* Edit btn */}
                      <button
                        onClick={(e) => openEdit(table, e)}
                        className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 bg-white/80 text-slate-500 hover:text-slate-800 transition-all"
                      >
                        <EditIcon className="w-3 h-3" />
                      </button>

                      {/* Status dot */}
                      <div className={`w-2 h-2 rounded-full ${cfg.dot} mb-2`} />

                      <p className={`font-display font-bold text-xl ${cfg.text}`}>T{table.number}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{table.capacity} seats</p>

                      {table.occupiedSince && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                          <ClockIcon className="w-3 h-3" />
                          {timeAgo(table.occupiedSince)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table detail drawer */}
      <Drawer
        open={!!selectedTable}
        onClose={() => setSelectedTable(null)}
        title={`Table ${selectedTable?.number}`}
        width="w-[420px]"
      >
        {selectedTable && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <TableStatusBadge status={selectedTable.status} />
              <span className="text-sm text-slate-500">{selectedTable.capacity} seats</span>
            </div>

            {selectedTable.section && (
              <p className="text-sm text-slate-500">Section: <strong className="text-slate-700">{selectedTable.section}</strong></p>
            )}

            {selectedTable.occupiedSince && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <ClockIcon className="w-4 h-4 text-slate-400" />
                Occupied for <strong>{timeAgo(selectedTable.occupiedSince)}</strong>
              </div>
            )}

            {/* Active order */}
            {selectedTable.orders && selectedTable.orders.length > 0 ? (
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs font-semibold text-slate-400 font-display uppercase tracking-wide mb-3">Active Order</p>
                {selectedTable.orders.map((order: any) => (
                  <div key={order.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 font-display">{order.status}</span>
                      <span className="font-semibold text-slate-800 font-display">₹{Number(order.grandTotal).toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-xs text-slate-400">{order._count?.items ?? 0} item(s)</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl p-4 text-center text-slate-400 text-sm">
                No active order
              </div>
            )}

            {/* Reservations */}
            {selectedTable.reservations && selectedTable.reservations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 font-display uppercase tracking-wide mb-2">Upcoming Reservations</p>
                {selectedTable.reservations.map((r: any) => (
                  <div key={r.id} className="flex justify-between text-sm p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <div>
                      <p className="font-medium text-slate-700">{r.customerName}</p>
                      <p className="text-xs text-slate-500">{r.partySize} guests · {r.reservationTime}</p>
                    </div>
                    <span className="text-xs text-amber-600 font-display font-medium">{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Add/Edit modal */}
      <Modal
        open={showAddModal}
        onClose={handleClose}
        title={editTable ? 'Edit Table' : 'Add Table'}
        size="sm"
        footer={
          <>
            <button onClick={handleClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-900 disabled:opacity-60 hover:brightness-95" style={{ background: 'var(--accent)' }}>
              {saving ? 'Saving...' : editTable ? 'Update' : 'Add Table'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {[
            { label: 'Table Number *', key: 'number', type: 'text', placeholder: 'e.g. T1, A3' },
            { label: 'Capacity *', key: 'capacity', type: 'number', placeholder: '4' },
            { label: 'Floor', key: 'floor', type: 'text', placeholder: 'Ground Floor' },
            { label: 'Section', key: 'section', type: 'text', placeholder: 'Main Hall, Terrace' },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">{field.label}</label>
              <input
                type={field.type}
                value={form[field.key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
