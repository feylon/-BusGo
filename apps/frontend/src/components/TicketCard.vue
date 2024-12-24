<script setup lang="ts">
import Button from 'primevue/button';
import QrCode from './QrCode.vue';
import StatusBadge from './StatusBadge.vue';
import { useFormat } from '@/composables/useFormat';

defineProps<{ ticket: any }>();
const { t, time, date, money } = useFormat();
</script>

<template>
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between bg-gradient-to-r from-teal-700 to-cyan-700 px-5 py-3 text-white">
      <div>
        <div class="text-xs opacity-80">{{ t('ticket.number') }}</div>
        <div class="font-mono font-semibold tracking-wider">{{ ticket.ticketNumber }}</div>
      </div>
      <StatusBadge :status="ticket.status" />
    </div>
    <div class="grid gap-4 p-5 sm:grid-cols-[1fr_auto]">
      <div class="space-y-3">
        <div>
          <div class="text-lg font-semibold">{{ ticket.from?.city }} → {{ ticket.to?.city }}</div>
          <div class="muted text-sm">{{ ticket.trip?.route?.name }}</div>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div class="muted text-xs">{{ t('common.date') }}</div>
            <div class="font-medium">{{ date(ticket.trip?.departureAt) }}</div>
          </div>
          <div>
            <div class="muted text-xs">{{ t('trip.departure') }}</div>
            <div class="font-medium">{{ time(ticket.trip?.departureAt) }}</div>
          </div>
          <div>
            <div class="muted text-xs">{{ t('ticket.passenger') }}</div>
            <div class="font-medium">{{ ticket.passenger?.fullName }}</div>
          </div>
          <div>
            <div class="muted text-xs">{{ t('common.seat') }}</div>
            <div class="text-lg font-bold">{{ ticket.seatNumber }}</div>
          </div>
          <div>
            <div class="muted text-xs">{{ t('trip.bus') }}</div>
            <div class="font-medium">{{ ticket.trip?.bus?.plateNumber }}</div>
          </div>
          <div>
            <div class="muted text-xs">{{ t('common.price') }}</div>
            <div class="font-medium">{{ money(ticket.price) }}</div>
          </div>
        </div>
        <RouterLink v-if="['IN_PROGRESS', 'BOARDING', 'DELAYED'].includes(ticket.trip?.status)" :to="`/trip/${ticket.trip.id}`">
          <Button size="small" outlined icon="pi pi-map" :label="t('ticket.trackBus')" />
        </RouterLink>
      </div>
      <div v-if="ticket.qrToken" class="flex flex-col items-center gap-2">
        <QrCode :value="ticket.qrToken" :size="170" />
        <span class="muted max-w-[170px] text-center text-xs">{{ t('ticket.showQr') }}</span>
      </div>
      <div v-else-if="ticket.usedAt" class="muted text-sm">{{ t('ticket.usedAt') }}: {{ date(ticket.usedAt) }} {{ time(ticket.usedAt) }}</div>
    </div>
  </div>
</template>
