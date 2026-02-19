import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface TokenEvent {
  tokenNumber: number;
  customerName?: string;
  orderType: string;
}

export default function CounterTokenDisplay() {
  const { branchId } = useParams<{ branchId: string }>();
  const [currentToken, setCurrentToken] = useState<number | null>(null);
  const [prevToken, setPrevToken] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [time, setTime] = useState(new Date());
  const socketRef = useRef<Socket | null>(null);
  const animRef = useRef(false);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Socket.io connection
  useEffect(() => {
    if (!branchId) return;

    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', { branchId, station: 'COUNTER_DISPLAY' });
    });

    socket.on('disconnect', () => setConnected(false));

    // Listen for new token events
    socket.on('order:created', (data: TokenEvent) => {
      if (data.tokenNumber) {
        setPrevToken(currentToken);
        setCurrentToken(data.tokenNumber);
        setCustomerName(data.customerName ?? null);
        animRef.current = true;
      }
    });

    socket.on('order:token', (data: TokenEvent) => {
      if (data.tokenNumber) {
        setPrevToken(currentToken);
        setCurrentToken(data.tokenNumber);
        setCustomerName(data.customerName ?? null);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [branchId]);

  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center select-none"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        fontFamily: "'Syne', sans-serif",
      }}
    >
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-10 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-slate-900 text-sm"
            style={{ background: '#f59e0b' }}
          >
            RS
          </div>
          <span className="text-white font-bold text-lg">RestroSync</span>
        </div>

        <div className="text-center">
          <p className="text-slate-400 text-sm">{dateStr}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
          <span className="text-slate-400 text-sm">{connected ? 'Live' : 'Connecting...'}</span>
          <span className="text-white text-2xl font-bold tabular-nums">{timeStr}</span>
        </div>
      </div>

      {/* Main token display */}
      <div className="flex flex-col items-center justify-center flex-1 w-full px-8 gap-10">
        <p className="text-slate-400 text-2xl tracking-widest uppercase font-semibold">
          Now Serving
        </p>

        {currentToken !== null ? (
          <div className="flex flex-col items-center gap-4">
            <div
              className="relative flex items-center justify-center rounded-3xl"
              style={{
                width: '380px',
                height: '260px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                boxShadow: '0 0 80px rgba(245,158,11,0.35), 0 20px 60px rgba(0,0,0,0.5)',
              }}
            >
              <span
                className="font-bold text-slate-900 tabular-nums"
                style={{ fontSize: '140px', lineHeight: 1 }}
              >
                {String(currentToken).padStart(3, '0')}
              </span>
            </div>

            {customerName && (
              <p className="text-white text-3xl font-semibold tracking-wide mt-2">
                {customerName}
              </p>
            )}
          </div>
        ) : (
          <div
            className="flex items-center justify-center rounded-3xl border-2 border-slate-700"
            style={{ width: '380px', height: '260px' }}
          >
            <p className="text-slate-600 text-4xl font-bold">—</p>
          </div>
        )}

        {/* Previous token */}
        {prevToken !== null && (
          <div className="flex items-center gap-4 mt-4">
            <p className="text-slate-500 text-xl">Previous:</p>
            <div
              className="flex items-center justify-center rounded-2xl px-8 py-3"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="text-slate-400 text-4xl font-bold tabular-nums">
                {String(prevToken).padStart(3, '0')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center px-10 py-5 border-t border-slate-800">
        <p className="text-slate-600 text-sm tracking-widest uppercase">
          Please be ready when your number is displayed
        </p>
      </div>
    </div>
  );
}
