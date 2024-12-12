<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import { computed, onMounted, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api';
import { usePaged } from '@/composables/usePaged';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t, dt, money } = useFormat();
const { error } = useNotify();
const { items, total, rows, loading, query, load, onPage } = usePaged(api.tickets.list, { search: '', status: null });
const statusOptions = computed(() => [{ label: t('common.all'), value: null }, ...['ACTIVE', 'USED', 'CANCELLED', 'EXPIRED'].map((s) => ({ label: t(`status.${s}`), value: s }))]);
const verifyDialog = ref(false);
const token = ref('');
const result = ref<any>(null);

async function verify() {
  try {
    result.value = await api.tickets.verify(token.value.trim());
    load();
  } catch (e) {
    error(e);
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader :title="t('nav.tickets')">
      <Button :label="t('nav.qr')" icon="pi pi-qrcode" outlined @click="verifyDialog = true; result = null; token = ''" />
    </PageHeader>
    <div class="card p-4">
      <div class="mb-4 flex flex-wrap gap-3">
        <IconField class="w-full md:w-64">
          <InputIcon class="pi pi-search" />
          <InputText v-model="query.search" :placeholder="t('common.search')" class="w-full" />
        </IconField>
        <Select v-model="query.status" :options="statusOptions" option-label="label" option-value="value" class="w-44" />
      </div>
      <DataTable :value="items" :loading="loading" lazy paginator :rows="rows" :total-records="total" data-key="id" size="small" @page="onPage">
        <Column :header="t('ticket.number')"><template #body="{ data }"><span class="font-mono">{{ data.ticketNumber }}</span></template></Column>
        <Column :header="t('ticket.passenger')"><template #body="{ data }">{{ data.passenger?.fullName }}</template></Column>
        <Column :header="t('booking.route')"><template #body="{ data }">{{ data.from?.city }} → {{ data.to?.city }}</template></Column>
        <Column :header="t('trip.departure')"><template #body="{ data }">{{ dt(data.trip?.departureAt) }}</template></Column>
        <Column field="seatNumber" :header="t('common.seat')" />
        <Column :header="t('common.price')"><template #body="{ data }">{{ money(data.price) }}</template></Column>
        <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.status" /></template></Column>
        <Column :header="t('ticket.usedAt')"><template #body="{ data }">{{ dt(data.usedAt) }}</template></Column>
      </DataTable>
    </div>
    <Dialog v-model:visible="verifyDialog" modal :header="t('nav.qr')" class="w-full max-w-lg">
      <div class="flex gap-2">
        <InputText v-model="token" class="flex-1 font-mono text-xs" placeholder="BT1...." />
        <Button :label="t('driver.check')" :disabled="!token" @click="verify" />
      </div>
      <Message v-if="result" :severity="result.result === 'VALID' ? 'success' : 'error'" class="mt-4">
        <div class="font-semibold">{{ t(`status.${result.result}`) }}</div>
        <div v-if="result.ticket" class="text-sm">{{ result.ticket.passenger?.fullName }} · {{ t('common.seat') }} {{ result.ticket.seatNumber }} · {{ result.ticket.trip?.route?.name }}</div>
      </Message>
    </Dialog>
  </div>
</template>
