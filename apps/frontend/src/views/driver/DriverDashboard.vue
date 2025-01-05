<script setup lang="ts">
import Button from 'primevue/button';
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import TripMap from '@/components/TripMap.vue';
import EmptyState from '@/components/EmptyState.vue';
import StatCard from '@/components/StatCard.vue';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useDriverTrips } from '@/composables/useDriverTrips';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t, time, date, duration } = useFormat();
const { success, error, ask } = useNotify();
const auth = useAuthStore();
const router = useRouter();
const { trips, current, load } = useDriverTrips();

onMounted(() => load('today'));

const stops = computed(() =>
  (current.value?.route?.stops ?? []).map((s: any) => ({ name: s.stop?.name, latitude: s.stop?.latitude, longitude: s.stop?.longitude })),
);

async function act(fn: () => Promise<unknown>, confirmText?: string) {
  const run = async () => {
    try {
      await fn();
      success(t('common.saved'));
      await load('today');
    } catch (e) {
      error(e);
    }
  };
  if (confirmText) ask(confirmText, run, false);
  else run();
}

const boarding = () => act(() => api.driver.boarding(current.value.id));
const start = () => act(() => api.driver.start(current.value.id), `${t('driver.startTrip')}?`);
const finish = () => act(() => api.driver.finish(current.value.id), `${t('driver.finishTrip')}?`);
</script>

<template>
  <div>
    <PageHeader :title="t('dashboard.hello', { name: auth.user?.fullName?.split(' ')[0] })" :subtitle="date(new Date())" />
    <div class="grid gap-4 sm:grid-cols-3">
      <StatCard :label="t('dashboard.todayTrips')" :value="trips.length" icon="pi-calendar" />
      <StatCard :label="t('nav.passengers')" :value="current?.seats ? current.seats.sold + current.seats.reserved : 0" icon="pi-users" tone="blue" />
      <StatCard :label="t('common.status')" :value="current ? t(`status.${current.status}`) : '—'" icon="pi-flag" tone="violet" />
    </div>

    <div v-if="!current" class="card mt-6"><EmptyState icon="pi-calendar" :text="t('driver.noTrip')" /></div>
    <div v-else class="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
      <div class="card p-5">
        <div class="flex items-center justify-between">
          <span class="muted text-sm">{{ t('driver.todayTrip') }}</span>
          <StatusBadge :status="current.status" />
        </div>
        <h2 class="mt-2 text-xl font-semibold">{{ current.route.name }}</h2>
        <div class="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div><div class="muted text-xs">{{ t('trip.departure') }}</div><div class="text-2xl font-bold">{{ time(current.departureAt) }}</div></div>
          <div><div class="muted text-xs">{{ t('trip.arrival') }}</div><div class="text-2xl font-bold">{{ time(current.arrivalAt) }}</div></div>
          <div><div class="muted text-xs">{{ t('trip.bus') }}</div><div class="font-medium">{{ current.bus.name }}</div><div class="font-mono text-xs">{{ current.bus.plateNumber }}</div></div>
          <div><div class="muted text-xs">{{ t('search.duration') }}</div><div class="font-medium">{{ duration(current.route.durationMin) }}</div></div>
          <div><div class="muted text-xs">{{ t('admin.sold') }}</div><div class="font-medium">{{ current.seats?.sold }} / {{ current.seats?.total }}</div></div>
          <div v-if="current.delayMinutes"><div class="muted text-xs">{{ t('status.DELAYED') }}</div><div class="font-medium text-amber-600">+{{ current.delayMinutes }} {{ t('common.minutes') }}</div></div>
        </div>
        <div class="mt-6 grid gap-2">
          <Button v-if="['SCHEDULED', 'DELAYED'].includes(current.status)" icon="pi pi-sign-in" :label="t('driver.startBoarding')" outlined @click="boarding" />
          <Button v-if="['SCHEDULED', 'BOARDING', 'DELAYED'].includes(current.status)" icon="pi pi-play" :label="t('driver.startTrip')" @click="start" />
          <Button v-if="current.status === 'IN_PROGRESS'" icon="pi pi-flag-fill" severity="success" :label="t('driver.finishTrip')" @click="finish" />
          <div class="grid grid-cols-3 gap-2">
            <Button icon="pi pi-qrcode" severity="secondary" outlined :label="t('nav.qr')" @click="router.push('/driver/qr')" />
            <Button icon="pi pi-users" severity="secondary" outlined :label="t('nav.passengers')" @click="router.push({ path: '/driver/passengers', query: { trip: current.id } })" />
            <Button icon="pi pi-map-marker" severity="secondary" outlined :label="t('nav.tracking')" @click="router.push('/driver/tracking')" />
          </div>
        </div>
      </div>
      <div class="card overflow-hidden">
        <TripMap :stops="stops" height="460px" />
        <ol class="flex gap-4 overflow-x-auto p-4 text-sm">
          <li v-for="s in current.route.stops" :key="s.id" class="shrink-0">
            <div class="font-medium">{{ s.stop?.city }}</div>
            <div class="muted text-xs">{{ time(new Date(new Date(current.departureAt).getTime() + (s.arrivalOffsetMin + current.delayMinutes) * 60000)) }}</div>
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>
