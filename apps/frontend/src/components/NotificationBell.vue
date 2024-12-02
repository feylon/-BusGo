<script setup lang="ts">
import Popover from 'primevue/popover';
import Button from 'primevue/button';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationsStore } from '@/stores/notifications';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const store = useNotificationsStore();
const op = ref();
const router = useRouter();
const { dt, localized, t } = useFormat();
const { toast } = useNotify();

onMounted(() => {
  store.refresh();
  store.listen();
  store.onNew((n) => toast.add({ severity: 'info', summary: localized(n.title), detail: localized(n.body), life: 6000 }));
});

function open(n: any) {
  if (!n.readAt) store.markRead(n.id);
  op.value?.hide();
  if (n.data?.bookingId) router.push(`/my-bookings/${n.data.bookingId}`);
  else if (n.data?.tripId) router.push(`/trip/${n.data.tripId}`);
}
</script>

<template>
  <div class="relative">
    <Button text rounded severity="secondary" icon="pi pi-bell" :aria-label="t('nav.notifications')" @click="op?.toggle($event)" />
    <span
      v-if="store.unread"
      class="pointer-events-none absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white"
    >
      {{ store.unread > 99 ? '99+' : store.unread }}
    </span>
    <Popover ref="op">
      <div class="w-80 max-w-[85vw]">
        <div class="mb-2 flex items-center justify-between">
          <span class="font-semibold">{{ t('notifications.title') }}</span>
          <Button v-if="store.unread" text size="small" :label="t('notifications.markAll')" @click="store.markAll()" />
        </div>
        <div v-if="!store.latest.length" class="muted py-6 text-center text-sm">{{ t('notifications.empty') }}</div>
        <div class="max-h-96 space-y-1 overflow-auto">
          <button
            v-for="n in store.latest"
            :key="n.id"
            type="button"
            class="block w-full rounded-lg p-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
            @click="open(n)"
          >
            <div class="flex items-start gap-2">
              <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" :class="n.readAt ? 'bg-transparent' : 'bg-teal-500'" />
              <div class="min-w-0">
                <div class="text-sm font-medium">{{ localized(n.title) }}</div>
                <div class="muted line-clamp-2 text-xs">{{ localized(n.body) }}</div>
                <div class="muted mt-0.5 text-[11px]">{{ dt(n.createdAt) }}</div>
              </div>
            </div>
          </button>
        </div>
        <RouterLink to="/notifications" class="mt-2 block text-center text-sm text-teal-700 hover:underline" @click="op?.hide()">
          {{ t('common.view') }} →
        </RouterLink>
      </div>
    </Popover>
  </div>
</template>
