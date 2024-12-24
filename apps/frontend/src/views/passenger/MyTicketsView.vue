<script setup lang="ts">
import SelectButton from 'primevue/selectbutton';
import { computed, onMounted, ref } from 'vue';
import TicketCard from '@/components/TicketCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import { api } from '@/api';
import { useFormat } from '@/composables/useFormat';

const { t } = useFormat();
const tickets = ref<any[]>([]);
const tab = ref<'upcoming' | 'past'>('upcoming');
const tabs = computed(() => [
  { label: t('ticket.upcoming'), value: 'upcoming' },
  { label: t('ticket.past'), value: 'past' },
]);

onMounted(async () => {
  tickets.value = (await api.tickets.mine({ limit: 100 })).items;
});

const list = computed(() =>
  tickets.value.filter((x) => (tab.value === 'upcoming' ? x.status === 'ACTIVE' : x.status !== 'ACTIVE')),
);
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8">
    <div class="mb-6 flex items-center justify-between gap-3">
      <h1 class="page-title">{{ t('nav.myTickets') }}</h1>
      <SelectButton v-model="tab" :options="tabs" option-label="label" option-value="value" :allow-empty="false" />
    </div>
    <EmptyState v-if="!list.length" icon="pi-qrcode" :text="t('ticket.empty')" />
    <div class="grid gap-4 md:grid-cols-2">
      <TicketCard v-for="tk in list" :key="tk.id" :ticket="tk" />
    </div>
  </div>
</template>
