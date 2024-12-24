<script setup lang="ts">
import Button from 'primevue/button';
import Skeleton from 'primevue/skeleton';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SearchForm from '@/components/SearchForm.vue';
import EmptyState from '@/components/EmptyState.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api';
import { isoDate, todayIso, useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const route = useRoute();
const router = useRouter();
const { t, money, time, duration, weekday } = useFormat();
const { error } = useNotify();
const trips = ref<any[]>([]);
const loading = ref(false);

const q = computed(() => ({
  from: String(route.query.from ?? ''),
  to: String(route.query.to ?? ''),
  date: String(route.query.date ?? todayIso()),
  passengers: Number(route.query.passengers ?? 1),
}));

const days = computed(() => {
  const base = new Date(`${q.value.date}T12:00:00+05:00`);
  return Array.from({ length: 7 }, (_, i) => isoDate(new Date(base.getTime() + (i - 3) * 86400000))).filter((d) => d >= todayIso());
});

async function load() {
  if (!q.value.from || !q.value.to) return;
  loading.value = true;
  try {
    trips.value = await api.trips.search(q.value);
  } catch (e) {
    error(e);
  } finally {
    loading.value = false;
  }
}

watch(q, load, { immediate: true });

function pickDay(d: string) {
  router.replace({ query: { ...route.query, date: d } });
}

function open(trip: any) {
  router.push({ name: 'trip', params: { id: trip.id }, query: { from: trip.from.id, to: trip.to.id } });
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-6">
    <div class="card mb-6 p-4">
      <SearchForm :key="route.fullPath" :from="q.from" :to="q.to" :date="q.date" :passengers="q.passengers" />
    </div>

    <div class="mb-4 flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="d in days"
        :key="d"
        type="button"
        class="shrink-0 rounded-xl border px-4 py-2 text-sm transition"
        :class="d === q.date ? 'border-teal-600 bg-teal-600 text-white' : 'hover:border-teal-400'"
        style="border-color: var(--app-border)"
        @click="pickDay(d)"
      >
        {{ weekday(`${d}T12:00:00+05:00`) }}
      </button>
    </div>

    <h2 class="mb-3 text-lg font-semibold">
      {{ q.from }} → {{ q.to }} <span class="muted text-sm font-normal">· {{ t('search.results') }}: {{ trips.length }}</span>
    </h2>

    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 3" :key="i" height="120px" border-radius="14px" />
    </div>
    <EmptyState v-else-if="!trips.length" icon="pi-calendar-times" :text="t('search.noResults')" />
    <div v-else class="space-y-3">
      <div v-for="trip in trips" :key="trip.id" class="card flex flex-col gap-4 p-4 transition hover:shadow-md md:flex-row md:items-center">
        <div class="flex flex-1 items-center gap-4">
          <div class="text-center">
            <div class="text-2xl font-bold">{{ time(trip.departureAt) }}</div>
            <div class="muted text-xs">{{ trip.from.city }}</div>
          </div>
          <div class="flex flex-1 flex-col items-center">
            <div class="muted text-xs">{{ duration(trip.durationMin) }}</div>
            <div class="relative my-1 h-0.5 w-full bg-slate-200 dark:bg-slate-700">
              <span class="absolute -top-1 left-0 h-2.5 w-2.5 rounded-full bg-teal-600" />
              <span class="absolute -top-1 right-0 h-2.5 w-2.5 rounded-full border-2 border-teal-600 bg-white dark:bg-slate-900" />
            </div>
            <div class="muted text-xs">{{ trip.distanceKm }} {{ t('common.km') }}</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold">{{ time(trip.arrivalAt) }}</div>
            <div class="muted text-xs">{{ trip.to.city }}</div>
          </div>
        </div>
        <div class="flex-1 text-sm md:border-l md:pl-4" style="border-color: var(--app-border)">
          <div class="font-medium">{{ trip.route.name }}</div>
          <div class="muted">{{ trip.from.name }} → {{ trip.to.name }}</div>
          <div class="muted mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span><i class="pi pi-car mr-1" />{{ trip.bus?.model }}</span>
            <span v-for="a in trip.bus?.amenities ?? []" :key="a" class="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{{ t(`amenities.${a}`) }}</span>
            <StatusBadge v-if="trip.status !== 'SCHEDULED'" :status="trip.status" />
          </div>
        </div>
        <div class="flex items-center justify-between gap-4 md:flex-col md:items-end">
          <div class="text-right">
            <div class="text-xl font-bold text-teal-700 dark:text-teal-400">{{ money(trip.price) }}</div>
            <div class="text-xs" :class="trip.availableSeats < 5 ? 'text-rose-600' : 'muted'">{{ t('search.seatsLeft', { n: trip.availableSeats }) }}</div>
          </div>
          <Button :label="t('search.select')" icon="pi pi-angle-right" icon-pos="right" @click="open(trip)" />
        </div>
      </div>
    </div>
  </div>
</template>
