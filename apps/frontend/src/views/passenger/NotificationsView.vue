<script setup lang="ts">
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';
import Paginator from 'primevue/paginator';
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import EmptyState from '@/components/EmptyState.vue';
import { api } from '@/api';
import { useNotificationsStore } from '@/stores/notifications';
import { useFormat } from '@/composables/useFormat';

const { t, dt, localized } = useFormat();
const store = useNotificationsStore();
const router = useRouter();
const items = ref<any[]>([]);
const total = ref(0);
const unreadOnly = ref(false);
const page = ref(1);

async function load() {
  const res: any = await api.notifications.list({ page: page.value, limit: 20, unread: unreadOnly.value || undefined });
  items.value = res.items;
  total.value = res.total;
}

onMounted(load);
watch(unreadOnly, () => {
  page.value = 1;
  load();
});
store.onNew(() => load());

async function open(n: any) {
  if (!n.readAt) {
    await store.markRead(n.id);
    n.readAt = new Date().toISOString();
  }
  if (n.data?.bookingId) router.push(`/my-bookings/${n.data.bookingId}`);
}

async function readAll() {
  await store.markAll();
  load();
}

const icons: Record<string, string> = {
  BOOKING_CREATED: 'pi-ticket',
  BOOKING_CONFIRMED: 'pi-check-circle',
  BOOKING_CANCELLED: 'pi-times-circle',
  BOOKING_EXPIRED: 'pi-clock',
  PAYMENT_SUCCESS: 'pi-wallet',
  PAYMENT_FAILED: 'pi-exclamation-circle',
  PAYMENT_REFUNDED: 'pi-replay',
  TRIP_REMINDER: 'pi-bell',
  TRIP_DELAYED: 'pi-hourglass',
  TRIP_CANCELLED: 'pi-ban',
  TRIP_STARTED: 'pi-car',
  TICKET_CREATED: 'pi-qrcode',
  SYSTEM: 'pi-megaphone',
};
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="page-title">{{ t('notifications.title') }}</h1>
      <div class="flex items-center gap-4">
        <label class="flex items-center gap-2 text-sm"><ToggleSwitch v-model="unreadOnly" /> {{ t('notifications.unreadOnly') }}</label>
        <Button :label="t('notifications.markAll')" text size="small" @click="readAll" />
      </div>
    </div>
    <EmptyState v-if="!items.length" icon="pi-bell" :text="t('notifications.empty')" />
    <div class="space-y-2">
      <button v-for="n in items" :key="n.id" type="button" class="card flex w-full items-start gap-3 p-4 text-left transition hover:shadow-md" @click="open(n)">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" :class="n.readAt ? 'bg-slate-100 text-slate-500 dark:bg-slate-800' : 'bg-teal-50 text-teal-700 dark:bg-teal-900/40'">
          <i :class="['pi', icons[n.type] ?? 'pi-bell']" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium" :class="{ 'muted font-normal': n.readAt }">{{ localized(n.title) }}</span>
            <span class="muted shrink-0 text-xs">{{ dt(n.createdAt) }}</span>
          </div>
          <p class="muted mt-0.5 text-sm">{{ localized(n.body) }}</p>
        </div>
      </button>
    </div>
    <Paginator v-if="total > 20" class="mt-4" :rows="20" :total-records="total" @page="(e) => { page = e.page + 1; load(); }" />
  </div>
</template>
