import React, { useEffect, useState } from 'react';
import { reservationApi, tableApi } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import { ReservationStatusBadge } from '../../components/ui/Badge';
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ClockIcon, UsersIcon } from '../../components/ui/Icons';

interface Reservation {
  id: string;
  customerName: string;
  customerPhone: string | null;
  partySize: number;
  reservationDate: string;
  reservationTime: string;
  endTime: string | null;
  status: string;
  notes: string | null;
  table: { id: string; number: string; section: string | null };
}

const TIME_SLOTS = ['11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'];

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', partySize: '2',
    reservationDate: selectedDate, reservationTime: '19:00',
    endTime: '', tableId: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resRes, tabRes] = await Promise.all([
        reservationApi.getAll(selectedDate),
        tableApi.getAll(),
      ]);
      setReservations(resRes.data);
      setTables(tabRes.data);
    } catch {
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedDate]);

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await reservationApi.create({
        ...form,
        partySize: parseInt(form.partySize),
        customerPhone: form.customerPhone || undefined,
        endTime: form.endTime || undefined,
        notes: form.notes || undefined,
      });
      await fetchData();
      setShowModal(false);
      setForm({ customerName: '', customerPhone: '', partySize: '2', reservationDate: selectedDate, reservationTime: '19:00', endTime: '', tableId: '', notes: '' });
    } catch {
      // handle
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    await reservationApi.cancel(id);
    await fetchData();
  };

  const handleSeat = async (id: string) => {
    await reservationApi.seat(id);
    await fetchData();
  };

  const statusColor: Record<string, string> = {
    CONFIRMED: 'bg-blue-500',
    SEATED: 'bg-emerald-500',
    CANCELLED: 'bg-slate-400',
    NO_SHOW: 'bg-rose-400',
  };

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 anim-fade-up">
        <div>
          <h1 className="font-display font-bold text-slate-900 text-2xl">Reservations</h1>
          <p className="text-slate-500 text-sm mt-0.5">{reservations.length} reservation(s) today</p>
        </div>
        <button
          onClick={() => { set('reservationDate', selectedDate); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-display text-slate-900 hover:brightness-95"
          style={{ background: 'var(--accent)' }}
        >
          <PlusIcon className="w-4 h-4" /> New Reservation
        </button>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-4 mb-6 anim-fade-up delay-50">
        <button onClick={() => changeDate(-1)} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-slate-600">
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center">
          <p className="font-display font-semibold text-slate-800">{formattedDate}</p>
          <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="text-xs text-amber-600 hover:underline">Today</button>
        </div>
        <button onClick={() => changeDate(1)} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-slate-600">
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-display text-slate-500 text-sm">No reservations for this date</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold font-display text-slate-900 hover:brightness-95"
            style={{ background: 'var(--accent)' }}
          >
            Add one
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations
            .sort((a, b) => a.reservationTime.localeCompare(b.reservationTime))
            .map((r, i) => (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-5 anim-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Time */}
                <div className="text-center flex-shrink-0 w-16">
                  <div className={`w-2 h-2 rounded-full mx-auto mb-1.5 ${statusColor[r.status] ?? 'bg-slate-400'}`} />
                  <p className="font-display font-bold text-slate-800 text-lg leading-none">{r.reservationTime}</p>
                  {r.endTime && <p className="text-xs text-slate-400 mt-0.5">→ {r.endTime}</p>}
                </div>

                <div className="w-px h-12 bg-slate-100 flex-shrink-0" />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="font-display font-semibold text-slate-800">{r.customerName}</p>
                    <ReservationStatusBadge status={r.status} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <UsersIcon className="w-3.5 h-3.5" /> {r.partySize} guests
                    </span>
                    <span className="font-display">Table {r.table?.number}</span>
                    {r.customerPhone && <span>{r.customerPhone}</span>}
                  </div>
                  {r.notes && <p className="text-xs text-slate-400 mt-1 truncate">"{r.notes}"</p>}
                </div>

                {/* Actions */}
                {r.status === 'CONFIRMED' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleSeat(r.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold font-display hover:bg-emerald-600 transition-colors"
                    >
                      Seat
                    </button>
                    <button
                      onClick={() => handleCancel(r.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold font-display hover:bg-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="New Reservation"
        size="md"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.customerName || !form.tableId} className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-900 disabled:opacity-60 hover:brightness-95" style={{ background: 'var(--accent)' }}>
              {saving ? 'Saving...' : 'Create Reservation'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Customer Name *', key: 'customerName', type: 'text', placeholder: 'John Doe', span: 2 },
            { label: 'Phone', key: 'customerPhone', type: 'tel', placeholder: '+91 98765 43210', span: 1 },
            { label: 'Party Size *', key: 'partySize', type: 'number', placeholder: '2', span: 1 },
            { label: 'Date *', key: 'reservationDate', type: 'date', placeholder: '', span: 1 },
            { label: 'Notes', key: 'notes', type: 'text', placeholder: 'Window seat preferred', span: 2 },
          ].map((f) => (
            <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">{f.label}</label>
              <input
                type={f.type}
                value={form[f.key as keyof typeof form] as string}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Time *</label>
            <select value={form.reservationTime} onChange={(e) => set('reservationTime', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5 font-display">Table *</label>
            <select value={form.tableId} onChange={(e) => set('tableId', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              <option value="">Select a table</option>
              {tables.filter((t) => t.status === 'AVAILABLE' || t.status === 'RESERVED').map((t) => (
                <option key={t.id} value={t.id}>Table {t.number} ({t.capacity} seats) {t.section ? `· ${t.section}` : ''}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
