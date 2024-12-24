<script setup lang="ts">
import Button from 'primevue/button';
import Select from 'primevue/select';
import Message from 'primevue/message';
import SelectButton from 'primevue/selectbutton';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import TripMap from '@/components/TripMap.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api';
import { useDriverTrips } from '@/composables/useDriverTrips';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t, time } = useFormat();
const { error } = useNotify();
const { trips, current, load } = useDriverTrips();
const tripId = ref<string | null>(null);
const mode = ref<'gps' | 'simulate'>('simulate');
const modes = computed(() => [
  { label: t('driver.simulate'), value: 'simulate' },
  { label: t('driver.useGps'), value: 'gps' },
]);
const sharing = ref(false);
const sent = ref(0);
const last = ref<any>(null);
const lastError = ref('');
let watchId: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let path: [number, number][] = [];
let step = 0;

const trip = computed(() => trips.value.find((x) => x.id === tripId.value));
const trackable = computed(() => ['BOARDING', 'IN_PROGRESS', 'DELAYED'].includes(trip.value?.status));
const options = computed(() => trips.value.map((x) => ({ label: `${time(x.departureAt)} · ${x.route?.name}`, value: x.id })));
const stops = computed(() => (trip.value?.route?.stops ?? []).map((s: any) => ({ name: s.stop?.name, latitude: s.stop?.latitude, longitude: s.stop?.longitude })));
const vehicles = computed(() => (last.value ? [{ tripId: 'me', latitude: last.value.latitude, longitude: last.value.longitude, heading: last.value.heading, online: true }] : []));

function buildPath() {
  const pts = stops.value.map((s: any) => [s.latitude, s.longitude] as [number, number]);
  path = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const n = 60;
    for (let k = 0; k < n; k++) path.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  if (pts.length) path.push(pts[pts.length - 1]);
  if (last.value) {
    let best = 0;
    let dist = Infinity;
    path.forEach((p, i) => {
      const d = (p[0] - last.value.latitude) ** 2 + (p[1] - last.value.longitude) ** 2;
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    step = best;
  } else step = 0;
}

const bearing = (a: [number, number], b: [number, number]) => ((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI + 360) % 360;

async function push(latitude: number, longitude: number, speed?: number, heading?: number, accuracy?: number) {
  try {
    last.value = await api.tracking.push({ tripId: tripId.value, latitude, longitude, speed, heading, accuracy });
    sent.value++;
    lastError.value = '';
  } catch (e: any) {
    lastError.value = e?.response?.data?.message ?? e?.message;
    if (e?.response?.status === 403 || e?.response?.status === 409) stop();
  }
}

function start() {
  if (!tripId.value) return;
  sharing.value = true;
  sent.value = 0;
  if (mode.value === 'gps') {
    if (!navigator.geolocation) {
      error({ message: 'Geolocation is not supported' });
      sharing.value = false;
      return;
    }
    watchId = navigator.geolocation.watchPosition(
      (pos) => push(pos.coords.latitude, pos.coords.longitude, pos.coords.speed ? pos.coords.speed * 3.6 : undefined, pos.coords.heading ?? undefined, pos.coords.accuracy),
      (err) => (lastError.value = err.message),
      { enableHighAccuracy: true, maximumAge: 3000 },
    );
  } else {
    buildPath();
    timer = setInterval(() => {
      if (step >= path.length - 1) {
        stop();
        return;
      }
      const a = path[step];
      const b = path[step + 1];
      step++;
      push(b[0], b[1], 70 + Math.round(Math.random() * 20), bearing(a, b), 5);
    }, 3000);
  }
}

function stop() {
  sharing.value = false;
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  if (timer) clearInterval(timer);
  watchId = null;
  timer = null;
}

onMounted(async () => {
  await load('today');
  tripId.value = current.value?.id ?? null;
  if (tripId.value) {
    const cur: any = await api.tracking.current(tripId.value).catch(() => null);
    if (cur?.location) last.value = cur.location;
  }
});
onBeforeUnmount(stop);
</script>

<template>
  <div>
    <PageHeader :title="t('nav.tracking')">
      <Select v-model="tripId" :options="options" option-label="label" option-value="value" :placeholder="t('driver.selectTrip')" class="w-full md:w-80" :disabled="sharing" />
    </PageHeader>
    <div class="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div class="card h-fit space-y-4 p-5">
        <div v-if="trip" class="flex items-center justify-between">
          <span class="font-semibold">{{ trip.route?.name }}</span>
          <StatusBadge :status="trip.status" />
        </div>
        <Message v-if="trip && !trackable" severity="warn" size="small">{{ t('status.' + trip.status) }} — {{ t('driver.startTrip') }}</Message>
        <SelectButton v-model="mode" :options="modes" option-label="label" option-value="value" :allow-empty="false" :disabled="sharing" class="w-full" />
        <Button v-if="!sharing" class="w-full" icon="pi pi-send" :label="t('driver.shareLocation')" :disabled="!trackable" @click="start" />
        <Button v-else class="w-full" icon="pi pi-stop-circle" severity="danger" :label="t('driver.stopSharing')" @click="stop" />
        <div v-if="sharing" class="flex items-center gap-2 text-sm text-emerald-600">
          <span class="relative flex h-3 w-3"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span class="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" /></span>
          {{ t('driver.sending') }} · {{ t('driver.sentPoints', { n: sent }) }}
        </div>
        <Message v-if="lastError" severity="error" size="small">{{ lastError }}</Message>
        <div v-if="last" class="grid grid-cols-2 gap-3 text-sm">
          <div><div class="muted text-xs">{{ t('trip.speed') }}</div><b>{{ Math.round(last.speed) }} km/h</b></div>
          <div><div class="muted text-xs">{{ t('trip.distanceLeft') }}</div><b>{{ last.distanceLeftKm ?? '—' }} {{ t('common.km') }}</b></div>
          <div><div class="muted text-xs">{{ t('trip.eta') }}</div><b>{{ last.etaAt ? time(last.etaAt) : '—' }}</b></div>
          <div><div class="muted text-xs">{{ t('trip.lastUpdate') }}</div><b>{{ time(last.lastSeen ?? last.timestamp) }}</b></div>
        </div>
      </div>
      <div class="card overflow-hidden"><TripMap :stops="stops" :vehicles="vehicles" height="560px" /></div>
    </div>
  </div>
</template>
