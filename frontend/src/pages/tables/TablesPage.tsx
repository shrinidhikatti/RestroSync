import React, { useEffect, useState } from 'react';
import { tableApi, advancedPosApi } from '../../lib/api';
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
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BILLING' | 'MERGED';
  occupiedSince: string | null;
  mergedIntoTableId: string | null;
  mergedIntoTable: { id: string; number: string } | null;
  orders?: any[];
  reservations?: any[];
}

// captain name comes from the first active order
function getCaptainName(table: Table): string | null {
  return table.orders?.[0]?.captainName ?? null;
}

const statusConfig = {
  AVAILABLE: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  OCCUPIED:  { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    dot: 'bg-rose-500' },
  RESERVED:  { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-red-500' },
  BILLING:   { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  MERGED:    { bg: 'bg-slate-100',  border: 'border-slate-300',   text: 'text-slate-500',   dot: 'bg-slate-400' },
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

  // ── Transfer Table state ────────────────────────────────────────────────────
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');

  // ── Merge Tables state ─────────────────────────────────────────────────────
  const [showMerge, setShowMerge] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState('');

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

  const handleTransfer = async (toTableId: string) => {
    if (!selectedTable) return;
    const orderId = selectedTable.orders?.[0]?.id;
    if (!orderId) return;
    setTransferring(true);
    setTransferError('');
    try {
      await advancedPosApi.transferTable({ orderId, toTableId });
      setShowTransfer(false);
      setSelectedTable(null);
      await fetchTables();
    } catch (err: any) {
      setTransferError(err?.response?.data?.message ?? 'Transfer failed. Please try again.');
    } finally {
      setTransferring(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedTable || mergeSelection.length === 0) return;
    setMerging(true);
    setMergeError('');
    try {
      // Use table-level merge (works even without orders)
      await tableApi.merge({ primaryTableId: selectedTable.id, mergeTableIds: mergeSelection });
      setShowMerge(false);
      setMergeSelection([]);
      setSelectedTable(null);
      await fetchTables();
    } catch (err: any) {
      setMergeError(err?.response?.data?.message ?? 'Merge failed. Please try again.');
    } finally {
      setMerging(false);
    }
  };

  const handleUnmerge = async () => {
    if (!selectedTable) return;
    setMerging(true);
    try {
      await tableApi.unmerge(selectedTable.id);
      setSelectedTable(null);
      await fetchTables();
    } catch (err: any) {
      setMergeError(err?.response?.data?.message ?? 'Unmerge failed.');
    } finally {
      setMerging(false);
    }
  };

  const toggleMergeSelect = (tableId: string) => {
    setMergeSelection((prev) =>
      prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId]
    );
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
            {tables.filter((t) => t.status === 'MERGED').length > 0 && (
              <>{tables.filter((t) => t.status === 'MERGED').length} merged · </>
            )}
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
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-display text-white hover:brightness-95"
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
                  const isMerged = table.status === 'MERGED';
                  const captainName = getCaptainName(table);
                  return (
                    <button
                      key={table.id}
                      onClick={() => !isMerged && setSelectedTable(table)}
                      className={`relative p-4 rounded-2xl border-2 ${cfg.bg} ${cfg.border} text-left transition-all shadow-sm group ${isMerged ? 'cursor-not-allowed opacity-70' : 'hover:scale-[1.03] active:scale-[0.98] cursor-pointer'}`}
                    >
                      {/* Edit btn — hidden for merged tables */}
                      {!isMerged && (
                        <button
                          onClick={(e) => openEdit(table, e)}
                          className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 bg-white/80 text-slate-500 hover:text-slate-800 transition-all"
                        >
                          <EditIcon className="w-3 h-3" />
                        </button>
                      )}

                      {/* Status dot */}
                      <div className={`w-2 h-2 rounded-full ${cfg.dot} mb-2`} />

                      <p className={`font-display font-bold text-xl ${cfg.text}`}>T{table.number}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{table.capacity} seats</p>

                      {isMerged && table.mergedIntoTable && (
                        <p className="text-xs text-slate-400 mt-1 font-display">
                          ↳ Joined T{table.mergedIntoTable.number}
                        </p>
                      )}

                      {!isMerged && captainName && (
                        <p className="text-xs mt-1 font-display truncate" style={{ color: '#818cf8' }}>
                          👤 {captainName.split(' ')[0]}
                        </p>
                      )}

                      {!isMerged && table.occupiedSince && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
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

            {selectedTable.status === 'MERGED' && selectedTable.mergedIntoTable && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600">
                <span className="text-base">↳</span>
                This table is joined with <strong className="text-slate-800">T{selectedTable.mergedIntoTable.number}</strong>. Physically occupied — no new orders allowed.
              </div>
            )}

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
              <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-400 font-display uppercase tracking-wide">Active Order</p>
                {selectedTable.orders.map((order: any) => (
                  <div key={order.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 font-display">{order.status}</span>
                      <span className="font-semibold text-slate-800 font-display">₹{Number(order.grandTotal).toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-xs text-slate-400">{order._count?.items ?? 0} item(s)</p>
                    {order.captainName && (
                      <p className="text-xs font-display" style={{ color: '#818cf8' }}>
                        👤 Captain: <strong>{order.captainName}</strong>
                      </p>
                    )}
                  </div>
                ))}
                {/* Transfer — only with active order */}
                {selectedTable.status === 'OCCUPIED' && (
                  <button
                    onClick={() => { setShowTransfer(true); setTransferError(''); }}
                    className="w-full mt-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-slate-300 text-xs font-semibold font-display text-slate-500 hover:border-red-400 hover:text-red-600 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Move to Another Table
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl p-4 text-center text-slate-400 text-sm">
                No active order
              </div>
            )}

            {/* Merge / Unmerge — works for AVAILABLE and OCCUPIED tables */}
            {(selectedTable.status === 'AVAILABLE' || selectedTable.status === 'OCCUPIED') && (
              <div className="space-y-2">
                <button
                  onClick={() => { setShowMerge(true); setMergeError(''); setMergeSelection([]); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-indigo-200 text-sm font-semibold font-display text-indigo-500 hover:border-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Merge with Another Table
                </button>

                {/* Show Unmerge if this table has other tables merged into it */}
                {tables.some((t) => t.mergedIntoTableId === selectedTable.id) && (
                  <button
                    onClick={handleUnmerge}
                    disabled={merging}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-rose-200 text-sm font-semibold font-display text-rose-500 hover:border-rose-400 hover:text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-60"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    {merging ? 'Unmerging…' : `Unmerge Tables (${tables.filter((t) => t.mergedIntoTableId === selectedTable.id).map((t) => 'T' + t.number).join(', ')})`}
                  </button>
                )}
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
                    <span className="text-xs text-red-600 font-display font-medium">{r.status}</span>
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
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:brightness-95" style={{ background: 'var(--accent)' }}>
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
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          ))}
        </div>
      </Modal>

      {/* ── Transfer Table Modal ─────────────────────────────────────────────── */}
      <Modal
        open={showTransfer}
        onClose={() => { setShowTransfer(false); setTransferError(''); }}
        title={`Move customers from T${selectedTable?.number ?? ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Select a free table to move the order to. Kitchen continues preparing — only the table assignment changes.
          </p>

          {transferError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-50 rounded-xl border border-rose-200 text-sm text-rose-700">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {transferError}
            </div>
          )}

          {/* Available tables grid */}
          {(() => {
            const available = tables.filter(
              (t) => t.status === 'AVAILABLE' && t.id !== selectedTable?.id,
            );
            if (available.length === 0) {
              return (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-2xl mb-2">🪑</p>
                  <p className="text-sm font-display font-medium">No tables are free right now</p>
                  <p className="text-xs mt-1">Wait for another table to become available.</p>
                </div>
              );
            }
            return (
              <div className="grid grid-cols-3 gap-3">
                {available.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTransfer(t.id)}
                    disabled={transferring}
                    className="relative p-4 rounded-2xl border-2 bg-emerald-50 border-emerald-200 text-left transition-all hover:scale-[1.04] active:scale-[0.97] hover:border-emerald-400 hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-wait"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mb-2" />
                    <p className="font-display font-bold text-xl text-emerald-700">T{t.number}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t.capacity} seats</p>
                    {t.section && <p className="text-xs text-slate-400 truncate">{t.section}</p>}
                  </button>
                ))}
              </div>
            );
          })()}
          {transferring && (
            <p className="text-center text-sm text-slate-400 font-display animate-pulse">Moving order…</p>
          )}
        </div>
      </Modal>
      {/* ── Merge Tables Modal ──────────────────────────────────────────────── */}
      <Modal
        open={showMerge}
        onClose={() => { setShowMerge(false); setMergeError(''); setMergeSelection([]); }}
        title={`Merge T${selectedTable?.number ?? ''} with...`}
        size="md"
        footer={
          <>
            <button
              onClick={() => { setShowMerge(false); setMergeSelection([]); }}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={merging || mergeSelection.length === 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:brightness-95 transition-colors"
              style={{ background: 'var(--accent)' }}
            >
              {merging ? 'Merging…' : `Merge ${mergeSelection.length + 1} Tables`}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Tap nearby tables to join them with <strong className="text-slate-700">T{selectedTable?.number}</strong>. Orders will go to T{selectedTable?.number} only.
          </p>

          {mergeError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-50 rounded-xl border border-rose-200 text-sm text-rose-700">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {mergeError}
            </div>
          )}

          {(() => {
            // Show AVAILABLE + OCCUPIED tables (not MERGED, RESERVED, or BILLING)
            const mergeable = tables.filter(
              (t) => (t.status === 'AVAILABLE' || t.status === 'OCCUPIED') && t.id !== selectedTable?.id,
            );
            if (mergeable.length === 0) {
              return (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-2xl mb-2">🪑</p>
                  <p className="text-sm font-display font-medium">No tables available to merge</p>
                  <p className="text-xs mt-1">Tables must be available or occupied to merge.</p>
                </div>
              );
            }
            return (
              <div className="grid grid-cols-3 gap-3">
                {mergeable.map((t) => {
                  const selected = mergeSelection.includes(t.id);
                  const isOccupied = t.status === 'OCCUPIED';
                  const cfg = statusConfig[t.status];
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleMergeSelect(t.id)}
                      className={`relative p-4 rounded-2xl border-2 text-left transition-all hover:scale-[1.04] active:scale-[0.97] ${
                        selected
                          ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200'
                          : `${cfg.bg} ${cfg.border} hover:border-indigo-300`
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                      <div className={`w-2 h-2 rounded-full mb-2 ${selected ? 'bg-indigo-500' : cfg.dot}`} />
                      <p className={`font-display font-bold text-xl ${selected ? 'text-indigo-700' : cfg.text}`}>T{t.number}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{t.capacity} seats</p>
                      {isOccupied && t.orders?.[0] && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          ₹{Number(t.orders[0].grandTotal ?? 0).toLocaleString('en-IN')}
                        </p>
                      )}
                      {!isOccupied && t.section && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{t.section}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {mergeSelection.length > 0 && (
            <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
              <p className="text-xs font-display font-semibold text-indigo-700">
                T{selectedTable?.number} + {mergeSelection.map((id) => `T${tables.find((t) => t.id === id)?.number}`).join(' + ')}
              </p>
              <p className="text-xs text-indigo-500 mt-0.5">
                Selected tables will be marked as merged. Place orders on T{selectedTable?.number}.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
