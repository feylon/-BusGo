<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import { computed, onMounted, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { usePaged } from '@/composables/usePaged';
import { downloadCsv, useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t, money, dt, phone } = useFormat();
const { success, error, ask } = useNotify();
const auth = useAuthStore();
const { items, total, rows, loading, query, load, onPage } = usePaged(api.bookings.list, { search: '', status: null, from: '', to: '' });
const statusOptions = computed(() => [{ label: t('common.all'), value: null }, ...['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'].map((s) => ({ label: t(`status.${s}`), value: s }))]);
const selected = ref<any>(null);

async function open(b: any) {
  selected.value = await api.bookings.get(b.id);
}

function cancel(b: any) {
  ask(t('booking.cancelConfirm'), async () => {
    try {
      await api.bookings.cancel(b.id, 'CANCELLED_BY_STAFF');
      success(t('booking.cancelled'));
      selected.value = null;
      load();
    } catch (e) {
      error(e);
    }
  });
}

function exportCsv() {
  downloadCsv(
    'bookings',
    items.value.map((b: any) => ({
      code: b.code,
      status: b.status,
      customer: b.user?.fullName,
      phone: b.user?.phone,
      route: b.trip?.route?.name,
      departure: b.trip?.departureAt,
      seats: b.items.map((i: any) => i.seatNumber).join(' '),
      amount: b.totalAmount,
      payment: b.paymentStatus,
      created: b.createdAt,
    })),
  );
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader :title="t('nav.bookings')">
      <Button :label="t('common.exportCsv')" icon="pi pi-download" outlined @click="exportCsv" />
    </PageHeader>
    <div class="card p-4">
      <div class="mb-4 flex flex-wrap gap-3">
        <IconField class="w-full md:w-64">
          <InputIcon class="pi pi-search" />
          <InputText v-model="query.search" :placeholder="t('common.search')" class="w-full" />
        </IconField>
        <Select v-model="query.status" :options="statusOptions" option-label="label" option-value="value" class="w-44" />
        <InputText v-model="query.from" type="date" class="w-40" />
        <InputText v-model="query.to" type="date" class="w-40" />
      </div>
      <DataTable :value="items" :loading="loading" lazy paginator :rows="rows" :total-records="total" data-key="id" size="small" row-hover @page="onPage" @row-click="(e) => open(e.data)">
        <Column :header="t('booking.code')"><template #body="{ data }"><span class="font-mono font-semibold">{{ data.code }}</span></template></Column>
        <Column :header="t('booking.customer')"><template #body="{ data }"><div>{{ data.user?.fullName }}</div><div class="muted text-xs">{{ phone(data.user?.phone) }}</div></template></Column>
        <Column :header="t('booking.route')"><template #body="{ data }"><div>{{ data.from?.city }} → {{ data.to?.city }}</div><div class="muted text-xs">{{ dt(data.trip?.departureAt) }}</div></template></Column>
        <Column :header="t('common.seats')"><template #body="{ data }">{{ data.items.map((i: any) => i.seatNumber).join(', ') }}</template></Column>
        <Column :header="t('common.price')"><template #body="{ data }">{{ money(data.totalAmount) }}</template></Column>
        <Column :header="t('booking.paymentStatus')"><template #body="{ data }"><StatusBadge :status="data.paymentStatus" /></template></Column>
        <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.status" /></template></Column>
        <Column :header="t('booking.channel')" field="channel" />
        <Column :header="t('common.createdAt')"><template #body="{ data }"><span class="text-xs">{{ dt(data.createdAt) }}</span></template></Column>
      </DataTable>
    </div>

    <Dialog :visible="!!selected" modal :header="`${t('booking.title')} ${selected?.code ?? ''}`" class="w-full max-w-2xl" @update:visible="selected = null">
      <div v-if="selected" class="space-y-4">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="muted">{{ t('common.status') }}:</span> <StatusBadge :status="selected.status" /></div>
          <div><span class="muted">{{ t('booking.paymentStatus') }}:</span> <StatusBadge :status="selected.paymentStatus" /></div>
          <div><span class="muted">{{ t('booking.route') }}:</span> {{ selected.from?.name }} → {{ selected.to?.name }}</div>
          <div><span class="muted">{{ t('trip.departure') }}:</span> {{ dt(selected.trip?.departureAt) }}</div>
          <div><span class="muted">{{ t('booking.customer') }}:</span> {{ selected.user?.fullName }} · {{ phone(selected.user?.phone) }}</div>
          <div><span class="muted">{{ t('common.price') }}:</span> <b>{{ money(selected.totalAmount) }}</b></div>
          <div v-if="selected.cancelReason" class="col-span-2"><span class="muted">{{ t('common.reason') }}:</span> {{ selected.cancelReason }}</div>
        </div>
        <DataTable :value="selected.tickets?.length ? selected.tickets : selected.items" size="small">
          <Column :header="t('common.seat')"><template #body="{ data }">{{ data.seatNumber }}</template></Column>
          <Column :header="t('ticket.passenger')"><template #body="{ data }">{{ data.passenger?.fullName ?? data.passenger }}</template></Column>
          <Column :header="t('ticket.number')"><template #body="{ data }"><span class="font-mono text-xs">{{ data.ticketNumber ?? '—' }}</span></template></Column>
          <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.status ?? (data.active ? 'ACTIVE' : 'CANCELLED')" /></template></Column>
        </DataTable>
      </div>
      <template #footer>
        <Button v-if="selected && ['PENDING', 'CONFIRMED'].includes(selected.status) && auth.can('bookings.cancel')" :label="t('booking.cancel')" severity="danger" outlined icon="pi pi-times" @click="cancel(selected)" />
        <Button :label="t('common.close')" text @click="selected = null" />
      </template>
    </Dialog>
  </div>
</template>
