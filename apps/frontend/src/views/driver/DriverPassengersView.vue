<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Select from 'primevue/select';
import Button from 'primevue/button';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t, dt, phone } = useFormat();
const { error } = useNotify();
const route = useRoute();
const trips = ref<any[]>([]);
const tripId = ref<string | null>((route.query.trip as string) ?? null);
const list = ref<any[]>([]);
const loading = ref(false);
const options = computed(() => trips.value.map((x) => ({ label: `${dt(x.departureAt)} · ${x.route?.name}`, value: x.id })));
const boarded = computed(() => list.value.filter((p) => p.ticket?.status === 'USED').length);

async function load() {
  if (!tripId.value) return;
  loading.value = true;
  try {
    list.value = await api.driver.passengers(tripId.value);
  } catch (e) {
    error(e);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  const [today, upcoming] = await Promise.all([api.driver.trips('today'), api.driver.trips('upcoming')]);
  const seen = new Set<string>();
  trips.value = [...today, ...upcoming].filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  tripId.value ??= trips.value[0]?.id ?? null;
  load();
});
watch(tripId, load);
</script>

<template>
  <div>
    <PageHeader :title="t('nav.passengers')" :subtitle="list.length ? `${t('driver.boarded')}: ${boarded} / ${list.length}` : ''">
      <Select v-model="tripId" :options="options" option-label="label" option-value="value" :placeholder="t('driver.selectTrip')" class="w-full md:w-96" />
      <Button icon="pi pi-refresh" text @click="load" />
    </PageHeader>
    <div class="card p-4">
      <DataTable :value="list" :loading="loading" size="small" sort-field="seatNumber" :sort-order="1">
        <Column field="seatNumber" :header="t('common.seat')" sortable><template #body="{ data }"><span class="text-lg font-bold">{{ data.seatNumber }}</span></template></Column>
        <Column :header="t('common.fullName')"><template #body="{ data }">{{ data.passenger?.fullName }}</template></Column>
        <Column :header="t('common.phone')"><template #body="{ data }"><a :href="`tel:+${data.passenger?.phone}`" class="text-teal-700">{{ phone(data.passenger?.phone) }}</a></template></Column>
        <Column :header="t('common.from')"><template #body="{ data }">{{ data.from }} → {{ data.to }}</template></Column>
        <Column :header="t('ticket.number')"><template #body="{ data }"><span class="font-mono text-xs">{{ data.ticket?.ticketNumber ?? '—' }}</span></template></Column>
        <Column :header="t('common.status')">
          <template #body="{ data }">
            <StatusBadge v-if="data.ticket" :status="data.ticket.status === 'USED' ? 'USED' : data.ticket.status" />
            <StatusBadge v-else :status="data.bookingStatus" />
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>
