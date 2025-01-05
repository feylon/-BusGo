<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { Html5Qrcode } from 'html5-qrcode';
import PageHeader from '@/components/PageHeader.vue';
import { api } from '@/api';
import { useDriverTrips } from '@/composables/useDriverTrips';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t, dt, time } = useFormat();
const { error } = useNotify();
const { trips, current, load } = useDriverTrips();
const tripId = ref<string | null>(null);
const token = ref('');
const result = ref<any>(null);
const scanning = ref(false);
const cameraError = ref(false);
const checking = ref(false);
const history = ref<any[]>([]);
let scanner: Html5Qrcode | null = null;

const tripOptions = computed(() => trips.value.map((x) => ({ label: `${time(x.departureAt)} · ${x.route?.name}`, value: x.id })));

const palette: Record<string, { bg: string; icon: string }> = {
  VALID: { bg: 'bg-emerald-600', icon: 'pi-check-circle' },
  ALREADY_USED: { bg: 'bg-amber-500', icon: 'pi-exclamation-triangle' },
  EXPIRED: { bg: 'bg-slate-500', icon: 'pi-clock' },
  CANCELLED: { bg: 'bg-rose-600', icon: 'pi-ban' },
  INVALID: { bg: 'bg-rose-700', icon: 'pi-times-circle' },
};

async function verify(value: string) {
  if (checking.value || !value) return;
  checking.value = true;
  try {
    result.value = await api.tickets.verify(value.trim(), tripId.value ?? undefined);
    history.value = [result.value, ...history.value].slice(0, 10);
    if (navigator.vibrate) navigator.vibrate(result.value.result === 'VALID' ? 80 : [80, 60, 80]);
  } catch (e) {
    error(e);
  } finally {
    checking.value = false;
  }
}

async function startCamera() {
  cameraError.value = false;
  result.value = null;
  scanning.value = true;
  await nextTick();
  try {
    scanner = new Html5Qrcode('qr-reader');
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      async (text) => {
        await stopCamera();
        await verify(text);
      },
      () => undefined,
    );
  } catch {
    cameraError.value = true;
    scanning.value = false;
  }
}

async function stopCamera() {
  scanning.value = false;
  if (scanner?.isScanning) await scanner.stop().catch(() => undefined);
  scanner?.clear();
  scanner = null;
}

onMounted(async () => {
  await load('today');
  tripId.value = current.value?.id ?? null;
});
onBeforeUnmount(stopCamera);
</script>

<template>
  <div>
    <PageHeader :title="t('nav.qr')">
      <Select v-model="tripId" :options="tripOptions" option-label="label" option-value="value" show-clear :placeholder="t('driver.selectTrip')" class="w-full md:w-80" />
    </PageHeader>
    <div class="grid gap-6 lg:grid-cols-2">
      <div class="card p-5">
        <div v-show="scanning" id="qr-reader" class="mx-auto w-full max-w-sm overflow-hidden rounded-xl" />
        <div v-if="!scanning" class="flex flex-col items-center gap-4 py-6">
          <div class="flex h-24 w-24 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-900/40"><i class="pi pi-qrcode text-5xl" /></div>
          <Button :label="t('driver.scan')" icon="pi pi-camera" size="large" @click="startCamera" />
        </div>
        <Button v-else class="mt-3 w-full" :label="t('common.cancel')" severity="secondary" outlined @click="stopCamera" />
        <Message v-if="cameraError" severity="warn" class="mt-4">{{ t('driver.cameraError') }}</Message>
        <div class="mt-6">
          <label class="field-label">{{ t('driver.manualToken') }}</label>
          <div class="flex gap-2">
            <InputText v-model="token" class="flex-1 font-mono text-xs" placeholder="BT1...." @keyup.enter="verify(token)" />
            <Button :label="t('driver.check')" :loading="checking" :disabled="!token" @click="verify(token)" />
          </div>
        </div>
      </div>

      <div>
        <div v-if="result" class="overflow-hidden rounded-2xl text-white shadow-lg" :class="palette[result.result].bg">
          <div class="flex items-center gap-4 p-6">
            <i :class="['pi', palette[result.result].icon]" class="text-5xl" />
            <div>
              <div class="text-3xl font-bold">{{ t(`status.${result.result}`) }}</div>
              <div v-if="result.reason" class="text-sm opacity-90">{{ result.reason }}</div>
            </div>
          </div>
          <div v-if="result.ticket" class="grid grid-cols-2 gap-3 bg-black/15 p-6 text-sm">
            <div><div class="opacity-75">{{ t('ticket.passenger') }}</div><div class="text-lg font-semibold">{{ result.ticket.passenger?.fullName }}</div></div>
            <div><div class="opacity-75">{{ t('common.seat') }}</div><div class="text-3xl font-bold">{{ result.ticket.seatNumber }}</div></div>
            <div><div class="opacity-75">{{ t('booking.route') }}</div><div class="font-medium">{{ result.ticket.from?.city }} → {{ result.ticket.to?.city }}</div></div>
            <div><div class="opacity-75">{{ t('common.date') }}</div><div class="font-medium">{{ dt(result.ticket.trip?.departureAt) }}</div></div>
            <div class="col-span-2"><div class="opacity-75">{{ t('ticket.number') }}</div><div class="font-mono">{{ result.ticket.ticketNumber }}</div></div>
          </div>
          <div class="p-4"><Button :label="t('driver.scanAgain')" icon="pi pi-camera" severity="contrast" class="w-full" @click="startCamera" /></div>
        </div>
        <div v-if="history.length" class="card mt-4 p-4">
          <div v-for="(h, i) in history" :key="i" class="flex items-center justify-between border-b py-2 text-sm last:border-0" style="border-color: var(--app-border)">
            <span>{{ h.ticket?.passenger?.fullName ?? '—' }} <span class="muted">· {{ h.ticket?.seatNumber }}</span></span>
            <span class="flex items-center gap-2"><span class="h-2 w-2 rounded-full" :class="palette[h.result].bg" />{{ t(`status.${h.result}`) }} <span class="muted text-xs">{{ time(h.checkedAt) }}</span></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
