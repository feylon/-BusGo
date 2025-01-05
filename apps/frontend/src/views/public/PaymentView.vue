<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const route = useRoute();
const router = useRouter();
const { t, money, time, dt } = useFormat();
const { error } = useNotify();

const payment = ref<any>(null);
const booking = ref<any>(null);
const card = ref('8600 1234 5678 9012');
const expiry = ref('12/29');
const processing = ref(false);
const waiting = ref(false);
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval>;

const left = computed(() => {
  if (!booking.value?.expiresAt) return null;
  const s = Math.max(0, Math.floor((new Date(booking.value.expiresAt).getTime() - now.value) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
});

async function load() {
  try {
    payment.value = await api.payments.get(String(route.params.id));
    booking.value = await api.bookings.get(String(route.query.booking ?? payment.value.bookingId));
    if (booking.value.status === 'CONFIRMED') router.replace({ name: 'booking', params: { id: booking.value.id } });
  } catch (e) {
    error(e);
  }
}

async function waitConfirmed() {
  waiting.value = true;
  for (let i = 0; i < 20; i++) {
    const b = await api.bookings.get(booking.value.id);
    if (b.status === 'CONFIRMED') {
      router.replace({ name: 'booking', params: { id: b.id }, query: { paid: '1' } });
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  waiting.value = false;
}

async function complete(success: boolean) {
  processing.value = true;
  try {
    payment.value = await api.payments.mockComplete(payment.value.id, success);
    if (payment.value.status === 'SUCCEEDED') await waitConfirmed();
  } catch (e) {
    error(e);
  } finally {
    processing.value = false;
  }
}

async function retry() {
  try {
    const p = await api.bookings.pay(booking.value.id);
    router.replace({ name: 'payment', params: { id: p.id }, query: { booking: booking.value.id } });
    payment.value = p;
  } catch (e) {
    error(e);
  }
}

onMounted(() => {
  load();
  timer = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-10">
    <div v-if="!payment || !booking" class="flex justify-center py-20"><ProgressSpinner /></div>
    <div v-else class="grid gap-6 md:grid-cols-[1fr_320px]">
      <div class="card p-6">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><i class="pi pi-credit-card text-xl" /></div>
          <div>
            <h1 class="text-xl font-semibold">{{ t('payment.mockTitle') }}</h1>
            <p class="muted text-sm">{{ t('payment.mockNote') }}</p>
          </div>
        </div>

        <div v-if="waiting" class="flex flex-col items-center gap-3 py-10">
          <ProgressSpinner style="width: 48px; height: 48px" />
          <p class="muted">{{ t('booking.waitingConfirm') }}</p>
        </div>
        <template v-else-if="payment.status === 'FAILED'">
          <Message severity="error">{{ t('payment.failed') }} · {{ payment.failureReason }}</Message>
          <Button class="mt-4" :label="t('payment.retry')" icon="pi pi-refresh" :disabled="booking.status !== 'PENDING'" @click="retry" />
        </template>
        <template v-else-if="payment.status === 'SUCCEEDED'">
          <Message severity="success">{{ t('payment.success') }}</Message>
        </template>
        <template v-else-if="booking.status !== 'PENDING'">
          <Message severity="warn">{{ t(`status.${booking.status}`) }}</Message>
        </template>
        <template v-else>
          <div class="rounded-2xl bg-gradient-to-br from-slate-800 to-teal-800 p-5 text-white shadow-lg">
            <div class="flex justify-between text-sm opacity-80"><span>MOCK BANK</span><i class="pi pi-wifi rotate-90" /></div>
            <div class="mt-6 font-mono text-xl tracking-widest">{{ card }}</div>
            <div class="mt-4 flex justify-between text-sm"><span>BUSLINE TEST</span><span>{{ expiry }}</span></div>
          </div>
          <div class="mt-5 grid gap-3 sm:grid-cols-2">
            <div>
              <label class="field-label">{{ t('payment.cardNumber') }}</label>
              <InputText v-model="card" class="w-full font-mono" />
            </div>
            <div>
              <label class="field-label">{{ t('payment.expiry') }}</label>
              <InputText v-model="expiry" class="w-full font-mono" />
            </div>
          </div>
          <div class="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button :label="`${t('payment.payNow')} · ${money(payment.amount)}`" icon="pi pi-check" class="flex-1" :loading="processing" @click="complete(true)" />
            <Button :label="t('payment.simulateFail')" icon="pi pi-times" severity="danger" outlined :disabled="processing" @click="complete(false)" />
          </div>
        </template>
      </div>

      <div class="card h-fit p-5">
        <div class="muted text-xs">{{ t('booking.code') }}</div>
        <div class="text-lg font-bold tracking-wider">{{ booking.code }}</div>
        <div class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between"><span class="muted">{{ t('booking.route') }}</span><span class="text-right">{{ booking.from?.city }} → {{ booking.to?.city }}</span></div>
          <div class="flex justify-between"><span class="muted">{{ t('trip.departure') }}</span><span>{{ dt(booking.trip?.departureAt) }}</span></div>
          <div class="flex justify-between"><span class="muted">{{ t('common.seats') }}</span><span>{{ booking.items.map((i: any) => i.seatNumber).join(', ') }}</span></div>
          <div class="flex justify-between"><span class="muted">{{ t('payment.transaction') }}</span><span class="font-mono text-xs">{{ payment.transactionId }}</span></div>
        </div>
        <div class="mt-4 border-t pt-4" style="border-color: var(--app-border)">
          <div class="muted text-xs">{{ t('payment.amount') }}</div>
          <div class="text-2xl font-bold">{{ money(payment.amount) }}</div>
        </div>
        <Message v-if="left && booking.status === 'PENDING'" severity="warn" size="small" class="mt-4" icon="pi pi-clock">
          {{ t('booking.payUntil', { time: time(booking.expiresAt) }) }} ({{ left }})
        </Message>
      </div>
    </div>
  </div>
</template>
