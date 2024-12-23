<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import SelectButton from 'primevue/selectbutton';
import Button from 'primevue/button';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { useDriverTrips } from '@/composables/useDriverTrips';
import { useFormat } from '@/composables/useFormat';

const { t, dt, time } = useFormat();
const router = useRouter();
const { trips, loading, load } = useDriverTrips();
const scope = ref('today');
const scopes = computed(() => ['today', 'upcoming', 'history'].map((s) => ({ label: t(`driver.scope.${s}`), value: s })));
onMounted(() => load(scope.value));
watch(scope, (s) => load(s));
</script>

<template>
  <div>
    <PageHeader :title="t('nav.trips')">
      <SelectButton v-model="scope" :options="scopes" option-label="label" option-value="value" :allow-empty="false" />
    </PageHeader>
    <div class="card p-4">
      <DataTable :value="trips" :loading="loading" size="small">
        <Column :header="t('admin.departureAt')"><template #body="{ data }">{{ dt(data.departureAt) }}</template></Column>
        <Column :header="t('trip.arrival')"><template #body="{ data }">{{ time(data.arrivalAt) }}</template></Column>
        <Column :header="t('admin.route')"><template #body="{ data }">{{ data.route?.name }}</template></Column>
        <Column :header="t('admin.bus')"><template #body="{ data }"><span class="font-mono text-xs">{{ data.bus?.plateNumber }}</span></template></Column>
        <Column :header="t('admin.sold')"><template #body="{ data }">{{ data.seats?.sold ?? 0 }} / {{ data.seats?.total ?? 0 }}</template></Column>
        <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.status" /></template></Column>
        <Column class="w-16">
          <template #body="{ data }"><Button icon="pi pi-users" text rounded size="small" @click="router.push({ path: '/driver/passengers', query: { trip: data.id } })" /></template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>
