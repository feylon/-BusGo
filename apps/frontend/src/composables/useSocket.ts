import { io, type Socket } from 'socket.io-client';
import { onBeforeUnmount } from 'vue';
import { tokens } from '@/api/http';

let socket: Socket | null = null;
const rooms = new Map<string, number>();

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: '/socket.io', transports: ['websocket', 'polling'], auth: (cb) => cb({ token: tokens.access }) });
    socket.on('connect', () => {
      for (const room of rooms.keys()) {
        if (room === 'tracking') socket!.emit('tracking:subscribe');
        else socket!.emit('trip:subscribe', { tripId: room });
      }
    });
  }
  return socket;
}

export function reconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket.connect();
}

export function useTripRoom(tripId: () => string | undefined, handlers: Record<string, (data: any) => void>) {
  const s = getSocket();
  let current: string | undefined;

  const join = () => {
    const id = tripId();
    if (!id || id === current) return;
    leave();
    current = id;
    rooms.set(id, (rooms.get(id) ?? 0) + 1);
    s.emit('trip:subscribe', { tripId: id });
  };

  const leave = () => {
    if (!current) return;
    const n = (rooms.get(current) ?? 1) - 1;
    if (n <= 0) {
      rooms.delete(current);
      s.emit('trip:unsubscribe', { tripId: current });
    } else rooms.set(current, n);
    current = undefined;
  };

  const wrapped = Object.entries(handlers).map(([event, fn]) => {
    const h = (data: any) => {
      if (!current || !data?.tripId || data.tripId === current || data.id === current) fn(data);
    };
    s.on(event, h);
    return [event, h] as const;
  });

  onBeforeUnmount(() => {
    leave();
    wrapped.forEach(([event, h]) => s.off(event, h));
  });

  return { join, leave };
}

export function useTrackingRoom(handlers: Record<string, (data: any) => void>) {
  const s = getSocket();
  rooms.set('tracking', 1);
  s.emit('tracking:subscribe');
  for (const [event, fn] of Object.entries(handlers)) s.on(event, fn);
  onBeforeUnmount(() => {
    rooms.delete('tracking');
    for (const [event, fn] of Object.entries(handlers)) s.off(event, fn);
  });
}
