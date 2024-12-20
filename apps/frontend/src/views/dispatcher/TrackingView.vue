<script setup lang="ts">
import Button from 'primevue/button';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import TripMap from '@/components/TripMap.vue';
import EmptyState from '@/components/EmptyState.vue';
import { api } from '@/api';
import { useFormat } from '@/composables/useFormat';
import { useTrackingRoom } from '@/composables/useSocket';

const { t, time, phone } = useFormat();
const vehicles = ref<any[]>([]);
const focus = ref<string | null>(null);
const trail = ref<any[]>([]);
let timer: ReturnType<typeof setInterval>;

async function load() {
  vehicles.value = await api.tracking.vehicles().catch(() => []);
}

useTrackingRoom({
  'vehicle.location.updated': (loc: any) => {
    const v = vehicles.value.find((x) => x.tripId === loc.tripId);
    if (v) v.location = loc;
    else load();
    if (focus.value === loc.tripId) trail.value = [...trail.value, loc];
  },
  'trip.updated': () => load(),
});

onMounted(() => {
  load();
  timer = setInterval(load, 60000);
});
onBeforeUnmount(() => clearInterval(timer));

async function select(id: string) {
  focus.value = id;
  trail.value = await api.tracking.history(id, 1000).catch(() => []);
}

const markers = computed(() =>
  vehicles.value
    .filter((v) => v.location)
    .map((v) => ({
      tripId: v.tripId,
      latitude: v.location.latitude,
      longitude: v.location.longitude,
      heading: v.location.heading,
      online: v.location.online,
      label: `${v.route.name} · ${v.bus?.plateNumber}`,
    })),
);
const routes = computed(() => vehicles.value.map((v) => ({ tripId: v.tripId, stops: v.stops })));
</script>

<template>
  <div>
    <PageHeader :title="t('nav.tracking')" :subtitle="`${vehicles.length} ${t('dashboard.activeTrips').toLowerCase()}`">
      <Button icon="pi pi-refresh" text @click="load" />
    </PageHeader>
    <div class="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div class="card overflow-hidden">
        <TripMap :routes="routes" :vehicles="markers" :trail="trail" :focus="focus" height="calc(100vh - 210px)" @select="select" />
      </div>
      <div class="space-y-3 xl:max-h-[calc(100vh-210px)] xl:overflow-y-auto">
        <EmptyState v-if="!vehicles.length" icon="pi-car" :text="t('common.noData')" />
        <button
          v-for="v in vehicles"
          :key="v.tripId"
          type="button"
          class="card block w-full p-4 text-left transition"
          :class="focus === v.tripId ? 'ring-2 ring-teal-600' : 'hover:shadow-md'"
          @click="select(v.tripId)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold">{{ v.route.name }}</span>
            <StatusBadge :status="v.status" />
          </div>
          <div class="muted mt-1 text-sm">{{ v.bus?.plateNumber }} · {{ v.driver?.fullName }} · {{ phone(v.driver?.phone) }}</div>
          <div v-if="v.location" class="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div><div class="muted">{{ t('trip.speed') }}</div><b>{{ Math.round(v.location.speed) }} km/h</b></div>
            <div><div class="muted">{{ t('trip.distanceLeft') }}</div><b>{{ v.location.distanceLeftKm ?? '—' }} {{ t('common.km') }}</b></div>
            <div><div class="muted">{{ t('trip.eta') }}</div><b>{{ v.location.etaAt ? time(v.location.etaAt) : '—' }}</b></div>
          </div>
          <div v-else class="muted mt-2 text-xs">{{ t('trip.waitingLocation') }}</div>
          <div class="mt-2 flex items-center justify-between text-xs">
            <StatusBadge :status="v.location?.online ? 'ONLINE' : 'OFFLINE'" />
            <span v-if="v.location" class="muted">{{ t('trip.lastUpdate') }}: {{ time(v.location.lastSeen) }}</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
