<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Message from 'primevue/message';
import Skeleton from 'primevue/skeleton';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SeatMap, { type MapSeat } from '@/components/SeatMap.vue';
import SeatLegend from '@/components/SeatLegend.vue';
import TripMap from '@/components/TripMap.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';
import { useTripRoom } from '@/composables/useSocket';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t, money, time, date, duration, dt } = useFormat();
const { error } = useNotify();

const id = computed(() => String(route.params.id));
const segment = computed(() => ({ fromStopId: route.query.from as string | undefined, toStopId: route.query.to as string | undefined }));

const map = ref<any>(null);
const details = ref<any>(null);
const tracking = ref<any>(null);
const settings = ref<any>({ maxSeatsPerBooking: 6 });
const saved = ref<any[]>([]);
const busy = ref<string | null>(null);
const submitting = ref(false);
const now = ref(Date.now());
const forms = reactive<Record<string, { fullName: string; phone: string; documentNumber: string }>>({});

const seats = computed<MapSeat[]>(() => map.value?.seats ?? []);
const selected = computed(() => seats.value.filter((s) => s.lockedByMe));
const total = computed(() => selected.value.reduce((sum, s) => sum + (s.price ?? 0), 0));
const bookable = computed(() => ['SCHEDULED', 'BOARDING', 'DELAYED'].includes(map.value?.trip?.status));
const live = computed(() => ['BOARDING', 'IN_PROGRESS', 'DELAYED'].includes(details.value?.status));
const lockLeft = computed(() => {
  const until = Math.min(...selected.value.map((s: any) => new Date(s.lockedUntil ?? 0).getTime()).filter(Boolean));
  if (!Number.isFinite(until)) return null;
  return Math.max(0, Math.floor((until - now.value) / 1000));
});
const lockText = computed(() => (lockLeft.value === null ? '' : `${Math.floor(lockLeft.value / 60)}:${String(lockLeft.value % 60).padStart(2, '0')}`));

const routeStops = computed(() =>
  (details.value?.route?.stops ?? []).map((s: any) => ({ name: s.stop?.name, latitude: s.stop?.latitude, longitude: s.stop?.longitude })),
);
const vehicles = computed(() =>
  tracking.value?.location
    ? [{ tripId: id.value, latitude: tracking.value.location.latitude, longitude: tracking.value.location.longitude, heading: tracking.value.location.heading, online: tracking.value.location.online }]
    : [],
);

function ensureForms() {
  selected.value.forEach((s, i) => {
    if (!forms[s.id]) {
      const prev = saved.value[i];
      forms[s.id] = i === 0 && !prev && auth.user
        ? { fullName: auth.user.fullName, phone: `+${auth.user.phone}`, documentNumber: '' }
        : { fullName: prev?.fullName ?? '', phone: prev ? `+${prev.phone}` : '', documentNumber: prev?.documentNumber ?? '' };
    }
  });
}

async function loadSeats() {
  map.value = await api.trips.seats(id.value, segment.value);
  ensureForms();
}

async function loadTracking() {
  if (!live.value) return;
  tracking.value = await api.tracking.current(id.value).catch(() => null);
}

async function load() {
  try {
    const [d, s] = await Promise.all([api.trips.get(id.value), api.settings.public().catch(() => settings.value)]);
    details.value = d;
    settings.value = s;
    await loadSeats();
    await loadTracking();
    if (auth.isAuthenticated) saved.value = await api.passengers.mine().catch(() => []);
  } catch (e) {
    error(e);
  }
}

const room = useTripRoom(() => id.value, {
  'seat.updated': (u: any) => {
    const seat = seats.value.find((s) => s.id === u.seatId);
    if (!seat) return;
    seat.status = u.status;
    (seat as any).lockedUntil = u.lockedUntil;
    seat.lockedByMe = u.status === 'LOCKED' && !!auth.user && u.lockedBy === auth.user.id;
  },
  'trip.updated': () => load(),
  'vehicle.location.updated': (loc: any) => {
    tracking.value = { ...(tracking.value ?? {}), location: loc };
  },
});

let timer: ReturnType<typeof setInterval>;
onMounted(async () => {
  await load();
  room.join();
  timer = setInterval(() => {
    now.value = Date.now();
    if (lockLeft.value === 0) loadSeats();
  }, 1000);
});
onBeforeUnmount(() => clearInterval(timer));

async function toggle(seat: MapSeat) {
  if (!auth.isAuthenticated) {
    router.push({ name: 'login', query: { redirect: route.fullPath } });
    return;
  }
  if (busy.value) return;
  busy.value = seat.id;
  try {
    if (seat.lockedByMe) {
      await api.trips.unlock(id.value, seat.id);
      seat.lockedByMe = false;
      seat.status = 'AVAILABLE';
      delete forms[seat.id];
    } else {
      if (selected.value.length >= settings.value.maxSeatsPerBooking) {
        error({ response: { data: { code: 'SEAT_LOCK_LIMIT', message: t('trip.maxSeats', { n: settings.value.maxSeatsPerBooking }) } } });
        return;
      }
      const res = await api.trips.lock(id.value, seat.id);
      seat.lockedByMe = true;
      seat.status = 'LOCKED';
      (seat as any).lockedUntil = res.lockedUntil;
      ensureForms();
    }
  } catch (e) {
    error(e);
    await loadSeats();
  } finally {
    busy.value = null;
  }
}

function usePrevious(seatId: string, p: any) {
  if (!p) return;
  forms[seatId] = { fullName: p.fullName, phone: `+${p.phone}`, documentNumber: p.documentNumber ?? '' };
}

async function submit() {
  submitting.value = true;
  try {
    const booking = await api.bookings.create({
      tripId: id.value,
      fromStopId: map.value.trip.from.id,
      toStopId: map.value.trip.to.id,
      seats: selected.value.map((s) => ({
        seatId: s.id,
        passenger: {
          fullName: forms[s.id].fullName,
          phone: forms[s.id].phone,
          ...(forms[s.id].documentNumber ? { documentNumber: forms[s.id].documentNumber } : {}),
        },
      })),
    });
    const payment = await api.bookings.pay(booking.id);
    router.push({ name: 'payment', params: { id: payment.id }, query: { booking: booking.id } });
  } catch (e) {
    error(e);
    await loadSeats();
  } finally {
    submitting.value = false;
  }
}

const formValid = computed(() => selected.value.length > 0 && selected.value.every((s) => forms[s.id]?.fullName?.trim().length >= 2 && forms[s.id]?.phone?.replace(/\D/g, '').length >= 9));
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-6">
    <div v-if="!map" class="space-y-4">
      <Skeleton height="120px" border-radius="14px" />
      <Skeleton height="420px" border-radius="14px" />
    </div>
    <template v-else>
      <div class="card mb-6 p-5">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-semibold">{{ map.trip.from.city }} → {{ map.trip.to.city }}</h1>
              <StatusBadge :status="map.trip.status" />
              <span v-if="map.trip.delayMinutes" class="text-sm text-amber-600">{{ t('trip.delayedBy', { n: map.trip.delayMinutes }) }}</span>
            </div>
            <div class="muted mt-1 text-sm">{{ map.trip.route.name }} · {{ date(map.trip.departureAt) }}</div>
          </div>
          <div class="flex items-center gap-6">
            <div>
              <div class="muted text-xs">{{ t('trip.departure') }}</div>
              <div class="text-xl font-bold">{{ time(map.trip.departureAt) }}</div>
              <div class="muted text-xs">{{ map.trip.from.name }}</div>
            </div>
            <i class="pi pi-arrow-right muted" />
            <div>
              <div class="muted text-xs">{{ t('trip.arrival') }}</div>
              <div class="text-xl font-bold">{{ time(map.trip.arrivalAt) }}</div>
              <div class="muted text-xs">{{ map.trip.to.name }}</div>
            </div>
            <div class="hidden md:block">
              <div class="muted text-xs">{{ t('search.duration') }}</div>
              <div class="font-semibold">{{ duration(map.trip.durationMin) }}</div>
            </div>
          </div>
        </div>
        <div class="muted mt-3 flex flex-wrap gap-3 text-sm">
          <span><i class="pi pi-car mr-1" />{{ map.trip.bus?.name }} · {{ map.trip.bus?.plateNumber }}</span>
          <span v-for="a in map.trip.bus?.amenities ?? []" :key="a" class="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{{ t(`amenities.${a}`) }}</span>
        </div>
      </div>

      <div v-if="live" class="card mb-6 overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3" style="border-color: var(--app-border)">
          <h2 class="font-semibold"><i class="pi pi-map mr-2 text-teal-600" />{{ t('trip.liveMap') }}</h2>
          <div v-if="tracking?.location" class="flex flex-wrap gap-4 text-sm">
            <span><span class="muted">{{ t('trip.speed') }}:</span> {{ Math.round(tracking.location.speed) }} km/h</span>
            <span v-if="tracking.location.distanceLeftKm !== null"><span class="muted">{{ t('trip.distanceLeft') }}:</span> {{ tracking.location.distanceLeftKm }} {{ t('common.km') }}</span>
            <span v-if="tracking.location.etaAt"><span class="muted">{{ t('trip.eta') }}:</span> {{ time(tracking.location.etaAt) }}</span>
            <StatusBadge :status="tracking.location.online ? 'ONLINE' : 'OFFLINE'" />
          </div>
          <span v-else class="muted text-sm">{{ t('trip.waitingLocation') }}</span>
        </div>
        <TripMap :stops="routeStops" :vehicles="vehicles" height="360px" />
      </div>

      <div class="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div class="card p-5">
          <div class="mb-4 flex items-center justify-between gap-4">
            <h2 class="font-semibold">{{ t('trip.seatMap') }}</h2>
            <span class="muted text-sm">{{ seats.filter((s) => s.status === 'AVAILABLE').length }} / {{ seats.length }}</span>
          </div>
          <div class="flex justify-center overflow-x-auto">
            <SeatMap :rows="map.layout.rows" :cols="map.layout.cols" :seats="seats" :fixtures="map.layout.fixtures" :interactive="bookable" @toggle="toggle" />
          </div>
          <SeatLegend class="mt-4" />
        </div>

        <div class="space-y-4">
          <Message v-if="!bookable" severity="warn">{{ t('trip.notBookable') }}</Message>
          <Message v-else-if="!auth.isAuthenticated" severity="info">
            {{ t('trip.loginToBook') }} —
            <RouterLink :to="{ name: 'login', query: { redirect: route.fullPath } }" class="font-semibold underline">{{ t('common.login') }}</RouterLink>
          </Message>
          <div v-else-if="!selected.length" class="card muted p-6 text-center">
            <i class="pi pi-hand-pointer mb-2 text-2xl" />
            <div>{{ t('trip.selectSeats') }}</div>
            <div class="mt-1 text-xs">{{ t('trip.maxSeats', { n: settings.maxSeatsPerBooking }) }}</div>
          </div>

          <template v-if="selected.length">
            <Message v-if="lockLeft !== null" severity="secondary" icon="pi pi-clock">{{ t('trip.lockExpires', { time: lockText }) }}</Message>
            <div v-for="(s, i) in selected" :key="s.id" class="card p-5">
              <div class="mb-3 flex items-center justify-between">
                <h3 class="font-semibold">{{ t('trip.passengerN', { n: i + 1 }) }} · {{ t('common.seat') }} {{ s.number }}</h3>
                <span class="text-sm font-semibold text-teal-700">{{ money(s.price) }}</span>
              </div>
              <div v-if="forms[s.id]" class="grid gap-3 md:grid-cols-3">
                <div>
                  <label class="field-label">{{ t('common.fullName') }}</label>
                  <InputText v-model="forms[s.id].fullName" class="w-full" />
                </div>
                <div>
                  <label class="field-label">{{ t('common.phone') }}</label>
                  <InputText v-model="forms[s.id].phone" placeholder="+998 90 123 45 67" class="w-full" />
                </div>
                <div>
                  <label class="field-label">{{ t('trip.document') }} <span class="text-xs">({{ t('common.optional') }})</span></label>
                  <InputText v-model="forms[s.id].documentNumber" class="w-full uppercase" />
                </div>
                <div v-if="saved.length" class="md:col-span-3">
                  <Select :options="saved" option-label="fullName" :placeholder="t('trip.usePrevious')" class="w-full md:w-72" @update:model-value="(p: any) => usePrevious(s.id, p)" />
                </div>
              </div>
            </div>
            <div class="card flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div class="muted text-sm">{{ t('trip.total') }}</div>
                <div class="text-2xl font-bold">{{ money(total) }}</div>
                <div class="muted text-xs">{{ selected.map((s) => s.number).join(', ') }} · {{ dt(map.trip.departureAt) }}</div>
              </div>
              <Button :label="t('trip.continue')" icon="pi pi-credit-card" size="large" :loading="submitting" :disabled="!formValid" @click="submit" />
            </div>
          </template>

          <div v-if="details?.route?.stops?.length" class="card p-5">
            <h3 class="mb-3 font-semibold">{{ t('trip.stops') }}</h3>
            <ol class="space-y-2 text-sm">
              <li v-for="s in details.route.stops" :key="s.id" class="flex items-center justify-between gap-3">
                <span class="flex items-center gap-2">
                  <span class="h-2.5 w-2.5 rounded-full" :class="[map.trip.from.id, map.trip.to.id].includes(s.stopId) ? 'bg-teal-600' : 'bg-slate-300'" />
                  {{ s.stop?.name }}
                </span>
                <span class="muted">{{ time(new Date(new Date(details.departureAt).getTime() + (s.arrivalOffsetMin + details.delayMinutes) * 60000)) }}</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
