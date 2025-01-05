<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import SearchForm from '@/components/SearchForm.vue';
import { api } from '@/api';
import { useFormat, todayIso } from '@/composables/useFormat';

const { t, duration } = useFormat();
const router = useRouter();
const routes = ref<any[]>([]);
const cities = ref<any[]>([]);

onMounted(async () => {
  const [r, c] = await Promise.all([api.routes.list({ limit: 12 }).catch(() => ({ items: [] })), api.stops.cities().catch(() => [])]);
  routes.value = r.items;
  cities.value = c;
});

const features = computed(() => [
  { icon: 'pi-th-large', title: t('home.features.seatsTitle'), text: t('home.features.seatsText') },
  { icon: 'pi-qrcode', title: t('home.features.qrTitle'), text: t('home.features.qrText') },
  { icon: 'pi-map', title: t('home.features.mapTitle'), text: t('home.features.mapText') },
]);

function open(r: any) {
  router.push({ name: 'trips', query: { from: r.origin?.city, to: r.destination?.city, date: todayIso() } });
}
</script>

<template>
  <section class="relative overflow-hidden bg-gradient-to-br from-teal-800 via-teal-700 to-cyan-700 text-white">
    <div class="pointer-events-none absolute inset-0 opacity-20" style="background-image: radial-gradient(circle at 20% 20%, white 1px, transparent 1px); background-size: 28px 28px" />
    <div class="relative mx-auto max-w-7xl px-4 pt-14 pb-24 md:pt-20">
      <h1 class="max-w-3xl text-3xl font-bold tracking-tight md:text-5xl">{{ t('home.title') }}</h1>
      <p class="mt-4 max-w-2xl text-base text-teal-50 md:text-lg">{{ t('home.subtitle') }}</p>
      <div class="mt-8 flex flex-wrap gap-6 text-sm text-teal-50">
        <div><span class="text-2xl font-bold text-white">{{ routes.length }}</span> {{ t('home.stats.routes') }}</div>
        <div><span class="text-2xl font-bold text-white">{{ cities.length }}</span> {{ t('home.stats.cities') }}</div>
      </div>
    </div>
  </section>

  <div class="mx-auto -mt-14 max-w-7xl px-4">
    <div class="card p-4 shadow-xl md:p-6">
      <SearchForm />
    </div>
  </div>

  <section class="mx-auto mt-12 max-w-7xl px-4">
    <h2 class="mb-4 text-xl font-semibold">{{ t('home.popular') }}</h2>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button v-for="r in routes" :key="r.id" type="button" class="card group p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg" @click="open(r)">
        <div class="flex items-center justify-between">
          <span class="rounded bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">{{ r.code }}</span>
          <i class="pi pi-arrow-right muted transition group-hover:translate-x-1 group-hover:text-teal-600" />
        </div>
        <div class="mt-3 text-lg font-semibold">{{ r.origin?.city }} → {{ r.destination?.city }}</div>
        <div class="muted mt-1 text-sm">
          {{ r.stops?.length }} {{ t('trip.stops').toLowerCase() }} · {{ Math.round(r.distanceKm) }} {{ t('common.km') }} · {{ duration(r.durationMin) }}
        </div>
        <div class="muted mt-2 line-clamp-1 text-xs">{{ r.stops?.map((s: any) => s.stop?.city).join(' · ') }}</div>
      </button>
    </div>
  </section>

  <section class="mx-auto mt-14 max-w-7xl px-4">
    <div class="grid gap-4 md:grid-cols-3">
      <div v-for="f in features" :key="f.title" class="card p-6">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
          <i :class="['pi', f.icon]" class="text-xl" />
        </div>
        <h3 class="font-semibold">{{ f.title }}</h3>
        <p class="muted mt-1 text-sm">{{ f.text }}</p>
      </div>
    </div>
  </section>
</template>
