import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/axios';
import { orderApi } from '../../lib/api';
import { connectSocket, disconnectSocket } from '../../lib/socket';
import { useAuthStore } from '../../stores/auth.store';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface KotItem {
  id: string;
  itemName: string;
  variantName: string | null;
  quantity: number;
  addons: { name: string; price: number }[] | null;
  specialInstructions: string | null;
  priority: string;
  status: string;
}

interface KotCard {
  id: string;
  kotNumber: string;
  roundNumber: number;
  kitchenStation: string | null;
  createdAt: string;
  captainName: string | null;
  order: {
    id: string;
    orderType: string;
    status: string;
    priority: string;
    tokenNumber: number | null;
    customerName: string | null;
    notes: string | null;
    table: { number: string; section: string | null } | null;
  };
  items: KotItem[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function elapsedMinutes(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
}

function getAgeColor(minutes: number): string {
  if (minutes < 8) return '#3b82f6';   // blue — fresh
  if (minutes < 15) return '#f59e0b';  // amber — in progress
  return '#ef4444';                     // red — delayed
}

function getAgeBg(minutes: number): string {
  if (minutes < 8) return 'rgba(59, 130, 246, 0.12)';
  if (minutes < 15) return 'rgba(245, 158, 11, 0.12)';
  return 'rgba(239, 68, 68, 0.12)';
}

const PRIORITY_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  VIP: { label: '★ VIP', color: '#fef3c7', bg: '#ef4444' },
  RUSH: { label: '⚡ RUSH', color: '#fff7ed', bg: '#f97316' },
  NORMAL: { label: '', color: '', bg: '' },
};

const ORDER_TYPE_LABEL: Record<string, string> = {
  DINE_IN: 'Dine In',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
  COMPLIMENTARY: 'Complimentary',
};

// ─── Audio helpers ──────────────────────────────────────────────────────────────

function playBeep(priority: string = 'NORMAL') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const freqs = priority === 'VIP' ? [880, 1100, 1320] : priority === 'RUSH' ? [660, 880] : [523];
    let time = ctx.currentTime;
    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
      osc.start(time);
      osc.stop(time + 0.3);
      time += 0.35;
    });
  } catch {
    // Audio not available
  }
}

// ─── KOT Card component ────────────────────────────────────────────────────────

function KotCardView({
  kot,
  onItemReady,
  onItemUnready,
  onAllReady,
}: {
  kot: KotCard;
  onItemReady: (itemId: string) => void;
  onItemUnready: (itemId: string) => void;
  onAllReady: (orderId: string) => void;
}) {
  const [elapsed, setElapsed] = useState(elapsedMinutes(kot.createdAt));
  // Initialise with server-side READY items so they appear checked from the start
  const [readyItems, setReadyItems] = useState<Set<string>>(
    () => new Set(kot.items.filter((i) => i.status === 'READY').map((i) => i.id))
  );

  // Live elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(elapsedMinutes(kot.createdAt));
    }, 30000);
    return () => clearInterval(interval);
  }, [kot.createdAt]);

  const borderColor = getAgeColor(elapsed);
  const bgColor = getAgeBg(elapsed);
  const priority = kot.order.priority;
  const badge = PRIORITY_BADGE[priority];

  const allMarked = kot.items.every((i) => readyItems.has(i.id));

  // Toggle: mark READY or undo back to PREPARING
  const handleToggleItem = (item: KotItem) => {
    const isReady = readyItems.has(item.id);
    setReadyItems((prev) => {
      const next = new Set(prev);
      isReady ? next.delete(item.id) : next.add(item.id);
      return next;
    });
    if (isReady) {
      onItemUnready(item.id);
    } else {
      onItemReady(item.id);
    }
  };

  const handleMarkAll = () => {
    const newReady = new Set(readyItems);
    kot.items.forEach((i) => newReady.add(i.id));
    setReadyItems(newReady);
    onAllReady(kot.order.id);
  };

  const isRunning = kot.roundNumber >= 2;

  return (
    <div
      className="rounded-2xl flex flex-col overflow-hidden"
      style={{
        border: `2px solid ${isRunning ? '#f97316' : borderColor}`,
        background: isRunning ? 'rgba(249,115,22,0.08)' : bgColor,
        minHeight: 220,
        boxShadow: isRunning ? '0 0 0 1px rgba(249,115,22,0.3), 0 4px 20px rgba(249,115,22,0.2)' : undefined,
      }}
    >
      {/* Running order banner — full width strip */}
      {isRunning && (
        <div
          className="flex items-center justify-between px-4 py-2 text-xs font-display font-bold tracking-wide"
          style={{
            background: 'linear-gradient(90deg, #ea580c, #f97316)',
            color: '#fff',
            animation: 'pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite',
          }}
        >
          <span>🔄 RUNNING ORDER — TABLE ALREADY EATING</span>
          <span className="opacity-80">Round {kot.roundNumber}</span>
        </div>
      )}

      {/* Header */}
      <div
        className="px-4 py-3 flex items-start justify-between gap-2"
        style={{ borderBottom: `1px solid ${isRunning ? '#f9731622' : borderColor + '22'}` }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {/* Order identifier */}
          <span className="font-display font-bold text-white text-xl">
            {kot.order.table
              ? `T${kot.order.table.number}`
              : kot.order.tokenNumber
              ? `#${kot.order.tokenNumber}`
              : kot.order.customerName ?? 'Walk-in'}
          </span>
          {kot.order.table?.section && (
            <span className="text-xs text-slate-400">{kot.order.table.section}</span>
          )}
          {/* Captain name — key for shift handover clarity */}
          {kot.captainName && (
            <span className="text-xs px-2 py-0.5 rounded-full font-display"
              style={{ background: 'rgba(99,102,241,0.25)', color: '#a5b4fc' }}>
              👤 {kot.captainName}
            </span>
          )}
          {/* Order type */}
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-display">
            {ORDER_TYPE_LABEL[kot.order.orderType] ?? kot.order.orderType}
          </span>
          {/* Priority badge */}
          {badge?.label && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-display font-bold"
              style={{ background: badge.bg, color: badge.color }}
            >
              {badge.label}
            </span>
          )}
        </div>
        {/* Elapsed time */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-sm font-display font-bold tabular-nums"
            style={{ color: isRunning ? '#f97316' : borderColor }}
          >
            {elapsed}m
          </span>
        </div>
      </div>

      {/* KOT number + station */}
      <div className="px-4 pt-2 pb-1 flex items-center gap-3 text-xs text-slate-500">
        <span className="font-mono">{kot.kotNumber}</span>
        {kot.kitchenStation && (
          <span className={`px-2 py-0.5 rounded font-display uppercase tracking-wide ${
            isRunning ? 'bg-orange-900/40 text-orange-400' : 'bg-slate-800 text-slate-400'
          }`}>
            {kot.kitchenStation}
          </span>
        )}
      </div>

      {/* Order notes */}
      {kot.order.notes && (
        <div className="mx-4 mb-2 px-3 py-1.5 bg-amber-900/30 border border-amber-700/40 rounded-lg text-xs text-amber-300">
          📋 {kot.order.notes}
        </div>
      )}

      {/* Items */}
      <div className="flex-1 px-4 pb-3 space-y-2">
        {kot.items.map((item) => {
          const isReady = readyItems.has(item.id);
          return (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 cursor-pointer group"
              onClick={() => handleToggleItem(item)}
              title={isReady ? 'Tap to undo (mark as not ready)' : 'Tap to mark as ready'}
            >
              <div className={`flex-1 transition-opacity ${isReady ? 'opacity-40 line-through' : ''}`}>
                <div className="flex items-baseline gap-2">
                  <span className="text-white font-display font-semibold text-base">
                    {item.quantity}×
                  </span>
                  <span className="text-white font-display font-semibold text-base">
                    {item.itemName}
                  </span>
                  {item.variantName && (
                    <span className="text-slate-400 text-sm">({item.variantName})</span>
                  )}
                </div>
                {item.addons && item.addons.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    {item.addons.map((a, i) => (
                      <span key={i} className="text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded">
                        + {a.name}
                      </span>
                    ))}
                  </div>
                )}
                {item.specialInstructions && (
                  <p className="text-xs text-slate-400 mt-0.5 italic">
                    🗒 {item.specialInstructions}
                  </p>
                )}
              </div>
              {/* Ready / undo indicator */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all mt-0.5 ${
                  isReady
                    ? 'bg-emerald-500 border-emerald-500 group-hover:bg-amber-500 group-hover:border-amber-500'
                    : 'border-slate-600 group-hover:border-emerald-400'
                }`}
              >
                {isReady ? (
                  /* On hover shows ↩ undo hint, normally shows ✓ */
                  <>
                    <svg className="w-4 h-4 text-white group-hover:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="hidden group-hover:block text-white text-xs font-bold">↩</span>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mark all ready button */}
      {!allMarked && (
        <div className="px-4 pb-4">
          <button
            onClick={handleMarkAll}
            className="w-full py-2.5 rounded-xl text-sm font-display font-bold text-white transition-all hover:brightness-110 active:scale-95"
            style={{ background: isRunning ? '#ea580c' : borderColor, color: isRunning ? '#fff' : '#0a0a0f' }}
          >
            {isRunning ? '🔄 Mark All Ready — Send Now!' : 'Mark All Ready ✓'}
          </button>
        </div>
      )}

      {allMarked && (
        <div className="px-4 pb-4">
          <div className="w-full py-2.5 rounded-xl text-sm font-display font-bold text-center bg-emerald-800/40 text-emerald-400 border border-emerald-700/40">
            ✓ All items ready
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main KDS Page ─────────────────────────────────────────────────────────────

export default function KitchenDisplay() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [kots, setKots] = useState<KotCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [stationFilter, setStationFilter] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null);
  const audioUnlockedRef = useRef(false);

  // Fetch initial KOT data
  const fetchKots = useCallback(async () => {
    try {
      const res = await api.get('/kds/orders', {
        params: stationFilter ? { station: stationFilter } : {},
      });
      const data: KotCard[] = res.data;
      // Sort: VIP → RUSH → Running (round≥2) → NORMAL; within group by createdAt ASC
      data.sort((a, b) => {
        const rank = (k: KotCard) => {
          if (k.order.priority === 'VIP')  return 0;
          if (k.order.priority === 'RUSH') return 1;
          if (k.roundNumber >= 2)          return 2;   // running orders bubble up
          return 3;
        };
        const ra = rank(a), rb = rank(b);
        if (ra !== rb) return ra - rb;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      setKots(data);
    } catch { } finally {
      setLoading(false);
    }
  }, [stationFilter]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Socket.io connection
  useEffect(() => {
    if (!user?.branchId) return;

    const socket = connectSocket(user.branchId, stationFilter || undefined);
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // New KOT from kitchen
    socket.on('kot:new', (payload: any) => {
      if (stationFilter && payload.kitchenStation !== stationFilter) return;
      playBeep(payload.items?.[0]?.priority ?? 'NORMAL');
      // Re-fetch to get full KOT data
      fetchKots();
    });

    // Order status updated (e.g. completed — remove from KDS)
    socket.on('order:updated', (payload: any) => {
      if (['COMPLETED', 'CANCELLED'].includes(payload.status)) {
        setKots((prev) => prev.filter((k) => k.order.id !== payload.orderId));
      }
    });

    // Payment complete → remove
    socket.on('payment:recorded', (payload: any) => {
      if (payload.isFullyPaid) {
        setKots((prev) => prev.filter((k) => k.order.id !== payload.orderId));
      }
    });

    fetchKots();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('kot:new');
      socket.off('order:updated');
      socket.off('payment:recorded');
      disconnectSocket();
    };
  }, [user?.branchId, stationFilter, fetchKots]);

  const handleItemReady = async (itemId: string) => {
    try {
      await api.patch(`/order-items/${itemId}/status`, { status: 'READY' });
    } catch { }
  };

  const handleItemUnready = async (itemId: string) => {
    try {
      await api.patch(`/order-items/${itemId}/status`, { status: 'PREPARING' });
    } catch { }
  };

  const handleAllReady = async (orderId: string) => {
    try {
      const order = await orderApi.getOne(orderId);
      const items = order.data?.items ?? [];
      await Promise.all(
        items
          .filter((i: any) => i.status === 'PREPARING')
          .map((i: any) => api.patch(`/order-items/${i.id}/status`, { status: 'READY' }))
      );
      setKots((prev) => prev.filter((k) => k.order.id !== orderId));
    } catch { }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const unlockAudio = () => {
    if (!audioUnlockedRef.current) {
      playBeep('NORMAL');
      audioUnlockedRef.current = true;
    }
  };

  const stations = ['', 'KITCHEN', 'BAR', 'DESSERT'];

  return (
    <div
      className="min-h-screen flex flex-col select-none"
      style={{ background: '#0a0a0f', fontFamily: 'DM Sans, sans-serif' }}
      onClick={unlockAudio}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ background: '#111118', borderBottom: '1px solid #1e1e2e' }}
      >
        <div className="flex items-center gap-4">
          {/* Back button */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-400 hover:text-white transition-colors"
            style={{ background: '#1e1e2e' }}
            title="Back to Dashboard"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-xs font-display font-medium">Back</span>
          </button>

          {/* Brand */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-slate-900 text-sm font-display"
              style={{ background: '#ef4444' }}
            >
              RS
            </div>
            <span className="font-display font-bold text-white text-lg">Kitchen Display</span>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: connected ? '#10b981' : '#ef4444' }}
            />
            <span className="text-xs text-slate-500">{connected ? 'Live' : 'Offline'}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Station filter */}
          <div className="flex items-center gap-1">
            {stations.map((s) => (
              <button
                key={s}
                onClick={() => setStationFilter(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all"
                style={{
                  background: stationFilter === s ? '#f59e0b' : '#1e1e2e',
                  color: stationFilter === s ? '#0a0a0f' : '#64748b',
                }}
              >
                {s || 'All'}
              </button>
            ))}
          </div>

          {/* Order count */}
          <div className="text-center">
            <p className="text-2xl font-display font-bold text-white tabular-nums leading-none">{kots.length}</p>
            <p className="text-xs text-slate-500">active</p>
          </div>

          {/* Clock */}
          <div className="text-right">
            <p className="text-xl font-display font-bold text-white tabular-nums leading-none">
              {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-slate-500">
              {currentTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
          </div>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>

          {/* Refresh */}
          <button
            onClick={fetchKots}
            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* KOT Grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="rounded-2xl animate-pulse"
                style={{ height: 220, background: '#1a1a2e' }}
              />
            ))}
          </div>
        ) : kots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-600">
            <svg className="w-24 h-24 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-display text-xl font-semibold">Kitchen is clear</p>
            <p className="text-sm mt-1">Waiting for new orders…</p>
          </div>
        ) : (
          <div className="grid gap-4" style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          }}>
            {kots.map((kot) => (
              <KotCardView
                key={kot.id}
                kot={kot}
                onItemReady={handleItemReady}
                onItemUnready={handleItemUnready}
                onAllReady={handleAllReady}
              />
            ))}
          </div>
        )}
      </div>

      {/* Color legend */}
      <div
        className="flex items-center gap-6 px-6 py-2 flex-shrink-0"
        style={{ background: '#111118', borderTop: '1px solid #1e1e2e' }}
      >
        {[
          { color: '#3b82f6', label: '< 8 min (Fresh)' },
          { color: '#f59e0b', label: '8–15 min (In progress)' },
          { color: '#ef4444', label: '> 15 min (Delayed)' },
          { color: '#f97316', label: 'Running order (table already eating)' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
        <div className="ml-auto text-xs text-slate-600">
          Tap item to mark ready · Tap again to undo · "Mark All" to complete KOT
        </div>
      </div>
    </div>
  );
}
