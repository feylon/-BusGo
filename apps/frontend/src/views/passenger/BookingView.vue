<script setup lang="ts">
import Button from 'primevue/button';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import StatusBadge from '@/components/StatusBadge.vue';
import TicketCard from '@/components/TicketCard.vue';
import { api } from '@/api';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const route = useRoute();
const router = useRouter();
const { t, money, dt } = useFormat();
const { error, ask, success } = useNotify();
const booking = ref<any>(null);
const tickets = ref<any[]>([]);

async function load() {
  booking.value = await api.bookings.get(String(route.params.id));
  const all = await api.tickets.mine({ limit: 100 });
  tickets.value = all.items.filter((x: any) => x.bookingId === booking.value.id);
}

onMounted(() => load().catch(error));

async function pay() {
  try {
    const p = await api.bookings.pay(booking.value.id);
    router.push({ name: 'payment', params: { id: p.id }, query: { booking: booking.value.id } });
  } catch (e) {
    error(e);
  }
}

function cancel() {
  ask(t('booking.cancelConfirm'), async () => {
    try {
      await api.bookings.cancel(booking.value.id);
      success(t('booking.cancelled'));
      await load();
    } catch (e) {
      error(e);
    }
  });
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8">
    <div v-if="!booking" class="flex justify-center py-20"><ProgressSpinner /></div>
    <template v-else>
      <Message v-if="route.query.paid" severity="success" class="mb-4">{{ t('payment.success') }}</Message>
      <div class="card mb-6 p-5">
        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div class="muted text-xs">{{ t('booking.code') }}</div>
            <div class="flex items-center gap-2">
              <span class="font-mono text-2xl font-bold tracking-wider">{{ booking.code }}</span>
              <StatusBadge :status="booking.status" />
            </div>
            <div class="mt-2 text-lg font-medium">{{ booking.from?.name }} → {{ booking.to?.name }}</div>
            <div class="muted text-sm">{{ booking.trip?.route?.name }} · {{ dt(booking.trip?.departureAt) }} · {{ booking.trip?.bus?.plateNumber }}</div>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold">{{ money(booking.totalAmount) }}</div>
            <div class="muted text-sm">{{ t('booking.paymentStatus') }}: <StatusBadge :status="booking.paymentStatus ?? 'PENDING'" /></div>
            <div class="mt-3 flex justify-end gap-2">
              <Button v-if="booking.status === 'PENDING'" :label="t('booking.pay')" icon="pi pi-credit-card" @click="pay" />
              <Button v-if="['PENDING', 'CONFIRMED'].includes(booking.status)" :label="t('booking.cancel')" severity="danger" outlined icon="pi pi-times" @click="cancel" />
            </div>
          </div>
        </div>
        <Message v-if="booking.status === 'PENDING' && booking.expiresAt" severity="warn" size="small" class="mt-4">{{ t('booking.payUntil', { time: dt(booking.expiresAt) }) }}</Message>
      </div>
      <h2 class="mb-3 font-semibold">{{ t('booking.tickets') }}</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <TicketCard v-for="tk in tickets" :key="tk.id" :ticket="tk" />
      </div>
      <div v-if="!tickets.length" class="card p-5">
        <div v-for="i in booking.items" :key="i.id" class="flex justify-between border-b py-2 last:border-0" style="border-color: var(--app-border)">
          <span>{{ i.passenger?.fullName }}</span>
          <span class="muted">{{ t('common.seat') }} {{ i.seatNumber }} · {{ money(i.price) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
