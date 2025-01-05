<script setup lang="ts">
import Button from 'primevue/button';
import { computed, onMounted, ref } from 'vue';
import StatCard from '@/components/StatCard.vue';
import TicketCard from '@/components/TicketCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import SearchForm from '@/components/SearchForm.vue';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useFormat } from '@/composables/useFormat';

const auth = useAuthStore();
const { t, money } = useFormat();
const tickets = ref<any[]>([]);
const bookings = ref<any>({ items: [], total: 0 });

onMounted(async () => {
  const [tk, bk] = await Promise.all([api.tickets.mine({ status: 'ACTIVE', limit: 50 }), api.bookings.mine({ limit: 100 })]);
  tickets.value = tk.items;
  bookings.value = bk;
});

const next = computed(() =>
  [...tickets.value]
    .filter((x) => new Date(x.trip?.departureAt).getTime() > Date.now() - 6 * 3600000)
    .sort((a, b) => new Date(a.trip.departureAt).getTime() - new Date(b.trip.departureAt).getTime())[0],
);
const spent = computed(() => bookings.value.items.filter((b: any) => ['CONFIRMED', 'COMPLETED'].includes(b.status)).reduce((s: number, b: any) => s + b.totalAmount, 0));
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8">
    <h1 class="page-title">{{ t('dashboard.hello', { name: auth.user?.fullName?.split(' ')[0] }) }}</h1>
    <div class="mt-6 grid gap-4 sm:grid-cols-3">
      <StatCard :label="t('dashboard.stats.bookings')" :value="bookings.total" icon="pi-ticket" />
      <StatCard :label="t('dashboard.stats.tickets')" :value="tickets.length" icon="pi-qrcode" tone="blue" />
      <StatCard :label="t('dashboard.stats.spent')" :value="money(spent)" icon="pi-wallet" tone="violet" />
    </div>
    <div class="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div>
        <h2 class="mb-3 font-semibold">{{ t('dashboard.nextTrip') }}</h2>
        <TicketCard v-if="next" :ticket="next" />
        <div v-else class="card"><EmptyState icon="pi-calendar" :text="t('dashboard.noTrips')" /></div>
      </div>
      <div>
        <h2 class="mb-3 font-semibold">{{ t('dashboard.quickBook') }}</h2>
        <div class="card p-4"><SearchForm /></div>
        <RouterLink to="/my-tickets"><Button class="mt-4" text icon="pi pi-qrcode" :label="t('nav.myTickets')" /></RouterLink>
      </div>
    </div>
  </div>
</template>
