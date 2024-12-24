<script setup lang="ts">
import InputText from 'primevue/inputtext';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import TripMap from '@/components/TripMap.vue';
import { api } from '@/api';
import { useFormat, todayIso } from '@/composables/useFormat';

const { t, duration } = useFormat();
const router = useRouter();
const routes = ref<any[]>([]);
const search = ref('');
const selected = ref<any>(null);

async function load() {
  routes.value = (await api.routes.list({ limit: 100, search: search.value || undefined })).items;
  if (!selected.value && routes.value.length) selected.value = routes.value[0];
}

onMounted(load);
let timer: ReturnType<typeof setTimeout>;
watch(search, () => {
  clearTimeout(timer);
  timer = setTimeout(load, 300);
});

const stopsOf = (r: any) => (r?.stops ?? []).map((s: any) => ({ name: s.stop?.name, latitude: s.stop?.latitude, longitude: s.stop?.longitude }));
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8">
    <div class="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <h1 class="page-title">{{ t('nav.routes') }}</h1>
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" :placeholder="t('common.search')" class="w-full md:w-72" />
      </IconField>
    </div>
    <div class="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div class="space-y-3">
        <button
          v-for="r in routes"
          :key="r.id"
          type="button"
          class="card block w-full p-4 text-left transition"
          :class="selected?.id === r.id ? 'ring-2 ring-teal-600' : 'hover:shadow-md'"
          @click="selected = r"
        >
          <div class="flex items-center justify-between">
            <span class="font-semibold">{{ r.name }}</span>
            <span class="text-xs font-semibold text-teal-700">{{ r.code }}</span>
          </div>
          <div class="muted mt-1 text-sm">{{ Math.round(r.distanceKm) }} {{ t('common.km') }} · {{ duration(r.durationMin) }}</div>
        </button>
      </div>
      <div v-if="selected" class="card overflow-hidden">
        <TripMap :stops="stopsOf(selected)" height="380px" />
        <div class="p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-lg font-semibold">{{ selected.name }}</h2>
            <button
              type="button"
              class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
              @click="router.push({ name: 'trips', query: { from: selected.origin?.city, to: selected.destination?.city, date: todayIso() } })"
            >
              <i class="pi pi-search mr-1" /> {{ t('search.find') }}
            </button>
          </div>
          <ol class="relative mt-5 border-l-2 border-teal-200 pl-6 dark:border-teal-800">
            <li v-for="s in selected.stops" :key="s.id" class="mb-5 last:mb-0">
              <span class="absolute -left-[9px] mt-1 h-4 w-4 rounded-full border-2 border-teal-600 bg-white dark:bg-slate-900" />
              <div class="font-medium">{{ s.stop?.name }}</div>
              <div class="muted text-sm">
                {{ s.stop?.city }} · +{{ duration(s.arrivalOffsetMin) }} · {{ Math.round(s.distanceFromStartKm) }} {{ t('common.km') }}
              </div>
            </li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>
