import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api';
import { getSocket } from '@/composables/useSocket';

export interface AppNotification {
  id: string;
  type: string;
  title: Record<string, string>;
  body: Record<string, string>;
  data: Record<string, any>;
  readAt: string | null;
  createdAt: string;
}

export const useNotificationsStore = defineStore('notifications', () => {
  const unread = ref(0);
  const latest = ref<AppNotification[]>([]);
  let listening = false;
  const listeners = new Set<(n: AppNotification) => void>();

  async function refresh() {
    try {
      const res: any = await api.notifications.list({ limit: 8 });
      latest.value = res.items;
      unread.value = res.unread;
    } catch {
      unread.value = 0;
    }
  }

  function listen() {
    if (listening) return;
    listening = true;
    getSocket().on('notification.created', (n: AppNotification) => {
      latest.value = [{ ...n, readAt: null }, ...latest.value].slice(0, 8);
      unread.value++;
      listeners.forEach((fn) => fn(n));
    });
  }

  function onNew(fn: (n: AppNotification) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  async function markRead(id: string) {
    await api.notifications.read(id);
    const n = latest.value.find((x) => x.id === id);
    if (n && !n.readAt) {
      n.readAt = new Date().toISOString();
      unread.value = Math.max(0, unread.value - 1);
    }
  }

  async function markAll() {
    await api.notifications.readAll();
    latest.value.forEach((n) => (n.readAt ??= new Date().toISOString()));
    unread.value = 0;
  }

  return { unread, latest, refresh, listen, onNew, markRead, markAll };
});
