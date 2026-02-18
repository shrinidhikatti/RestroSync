import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().token;
    socket = io('/', {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: { token },
    });
  }
  return socket;
}

export function connectSocket(branchId: string, station?: string): Socket {
  const s = getSocket();

  if (!s.connected) {
    s.connect();
  }

  s.once('connect', () => {
    s.emit('join', { branchId, station });
  });

  // Re-join on reconnect
  s.on('reconnect', () => {
    s.emit('join', { branchId, station });
  });

  return s;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
  socket = null;
}
