<script setup lang="ts">
import Button from 'primevue/button';
import Select from 'primevue/select';
import Paginator from 'primevue/paginator';
import { computed, onMounted } from 'vue';
import StatusBadge from '@/components/StatusBadge.vue';
import EmptyState from '@/components/EmptyState.vue';
import { api } from '@/api';
import { usePaged } from '@/composables/usePaged';
import { useFormat } from '@/composables/useFormat';

const { t, money, dt } = useFormat();
const { items, total, rows, query, load, onPage, loading } = usePaged(api.bookings.mine, { status: null }, 10);
const statuses = computed(() => [{ label: t('common.all'), value: null }, ...['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'].map((s) => ({ label: t(`status.${s}`), value: s }))]);
onMounted(load);
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8">
    <div class="mb-6 flex items-center justify-between gap-3">
      <h1 class="page-title">{{ t('nav.myBookings') }}</h1>
      <Select v-model="query.status" :options="statuses" option-label="label" option-value="value" class="w-48" />
    </div>
    <EmptyState v-if="!loading && !items.length" icon="pi-ticket" :text="t('booking.empty')">
      <RouterLink to="/"><Button :label="t('booking.findTrip')" /></RouterLink>
    </EmptyState>
    <div class="space-y-3">
      <RouterLink v-for="b in items" :key="b.id" :to="`/my-bookings/${b.id}`" class="card flex flex-col gap-3 p-4 transition hover:shadow-md md:flex-row md:items-center">
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="font-mono font-semibold">{{ b.code }}</span>
            <StatusBadge :status="b.status" />
          </div>
          <div class="mt-1 font-medium">{{ b.from?.city }} → {{ b.to?.city }}</div>
          <div class="muted text-sm">{{ dt(b.trip?.departureAt) }} · {{ t('common.seats') }}: {{ b.items.map((i: any) => i.seatNumber).join(', ') }}</div>
        </div>
        <div class="text-right">
          <div class="text-lg font-bold">{{ money(b.totalAmount) }}</div>
          <div class="muted text-xs">{{ dt(b.createdAt) }}</div>
        </div>
        <i class="pi pi-angle-right muted hidden md:block" />
      </RouterLink>
    </div>
    <Paginator v-if="total > rows" class="mt-4" :rows="rows" :total-records="total" @page="onPage" />
  </div>
</template>
