<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import ProgressBar from 'primevue/progressbar';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import StatCard from '@/components/StatCard.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import TripMap from '@/components/TripMap.vue';
import { api } from '@/api';
import { useFormat } from '@/composables/useFormat';
import { useTrackingRoom } from '@/composables/useSocket';

const { t, dt, money, time } = useFormat();
const live = ref<any>(null);
const vehicles = ref<any[]>([]);
let timer: ReturnType<typeof setInterval>;

async function load() {
  [live.value, vehicles.value] = await Promise.all([api.reports.live(), api.tracking.vehicles().catch(() => [])]);
}

useTrackingRoom({
  'vehicle.location.updated': (loc: any) => {
    const v = vehicles.value.find((x) => x.tripId === loc.tripId);
    if (v) v.location = loc;
  },
  'trip.updated': () => load(),
});

onMounted(() => {
  load();
  timer = setInterval(load, 30000);
});
onBeforeUnmount(() => clearInterval(timer));

const markers = computed(() =>
  vehicles.value
    .filter((v) => v.location)
    .map((v) => ({ tripId: v.tripId, latitude: v.location.latitude, longitude: v.location.longitude, heading: v.location.heading, online: v.location.online, label: `${v.route.name} · ${v.bus?.plateNumber}` })),
);
</script>

<template>
  <div>
    <PageHeader :title="t('nav.overview')">
      <RouterLink to="/dispatcher/tracking"><Button icon="pi pi-map" :label="t('nav.tracking')" outlined /></RouterLink>
    </PageHeader>
    <div v-if="live" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard :label="t('dashboard.todayTrips')" :value="live.todayTrips" icon="pi-calendar" />
      <StatCard :label="t('dashboard.activeTrips')" :value="live.activeTrips" icon="pi-car" tone="blue" />
      <StatCard :label="t('dashboard.delayed')" :value="live.delayed" icon="pi-hourglass" tone="amber" />
      <StatCard :label="t('dashboard.todaySales')" :value="live.todayBookings" icon="pi-ticket" tone="violet" :hint="money(live.todayRevenue)" />
    </div>
    <div class="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
      <div class="card overflow-hidden">
        <div class="border-b px-5 py-3 font-semibold" style="border-color: var(--app-border)">{{ t('dashboard.activeTrips') }}</div>
        <TripMap :vehicles="markers" height="380px" />
      </div>
      <div class="card p-4">
        <h3 class="mb-3 font-semibold">{{ t('dashboard.upcoming') }}</h3>
        <DataTable :value="live?.upcoming ?? []" size="small">
          <Column :header="t('common.time')"><template #body="{ data }">{{ dt(data.departureAt) }}</template></Column>
          <Column field="route" :header="t('admin.route')" />
          <Column field="plateNumber" :header="t('admin.plate')" />
          <Column :header="t('admin.sold')">
            <template #body="{ data }"><ProgressBar :value="data.total ? Math.round((data.sold / data.total) * 100) : 0" style="height: 14px; width: 90px" /></template>
          </Column>
          <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.status" /></template></Column>
        </DataTable>
      </div>
    </div>
    <div class="card mt-6 p-4">
      <h3 class="mb-3 font-semibold">{{ t('nav.tracking') }}</h3>
      <DataTable :value="vehicles" size="small">
        <Column :header="t('admin.route')"><template #body="{ data }">{{ data.route.name }}</template></Column>
        <Column :header="t('admin.bus')"><template #body="{ data }"><span class="font-mono text-xs">{{ data.bus?.plateNumber }}</span></template></Column>
        <Column :header="t('admin.driver')"><template #body="{ data }">{{ data.driver?.fullName }}</template></Column>
        <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.status" /></template></Column>
        <Column :header="t('trip.speed')"><template #body="{ data }">{{ data.location ? `${Math.round(data.location.speed)} km/h` : '—' }}</template></Column>
        <Column :header="t('trip.eta')"><template #body="{ data }">{{ data.location?.etaAt ? time(data.location.etaAt) : '—' }}</template></Column>
        <Column :header="t('trip.lastUpdate')"><template #body="{ data }"><StatusBadge :status="data.location?.online ? 'ONLINE' : 'OFFLINE'" /></template></Column>
      </DataTable>
    </div>
  </div>
</template>
