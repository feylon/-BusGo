<script setup lang="ts">
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import SelectButton from 'primevue/selectbutton';
import ProgressBar from 'primevue/progressbar';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import StatCard from '@/components/StatCard.vue';
import ChartBox from '@/components/ChartBox.vue';
import { api } from '@/api';
import { downloadCsv, isoDate, useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t, money, number } = useFormat();
const { error } = useNotify();
const tab = ref('sales');
const range = reactive({ from: isoDate(new Date(Date.now() - 29 * 86400000)), to: isoDate(new Date()), groupBy: 'day' });
const data = ref<any>(null);
const loading = ref(false);
const tabs = ['sales', 'routes', 'buses', 'drivers', 'trips', 'payments', 'passengers', 'cancellations'];
const groupOptions = computed(() => ['day', 'week', 'month'].map((g) => ({ label: t(`reports.${g}`), value: g })));
const PALETTE = ['#0f766e', '#0891b2', '#6366f1', '#f59e0b', '#ec4899', '#84cc16', '#ef4444'];

async function load() {
  loading.value = true;
  try {
    data.value = await api.reports.get(tab.value, { from: range.from, to: range.to, ...(tab.value === 'sales' ? { groupBy: range.groupBy } : {}) });
  } catch (e) {
    error(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(tab, () => {
  data.value = null;
  load();
});
watch(() => range.groupBy, load);

const rowsOf = computed<any[]>(() => {
  const d = data.value;
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (tab.value === 'sales') return d.items;
  if (tab.value === 'payments') return d.byStatus;
  if (tab.value === 'cancellations') return d.byReason;
  if (tab.value === 'trips') return d.byStatus;
  if (tab.value === 'passengers') return d.top;
  return [];
});

const salesChart = computed(() => ({
  labels: (data.value?.items ?? []).map((s: any) => s.period),
  datasets: [
    { type: 'line', label: t('reports.revenue'), data: (data.value?.items ?? []).map((s: any) => s.revenue), borderColor: '#0f766e', backgroundColor: 'rgba(15,118,110,.15)', fill: true, tension: 0.3, yAxisID: 'y' },
    { type: 'bar', label: t('reports.tickets'), data: (data.value?.items ?? []).map((s: any) => s.tickets), backgroundColor: 'rgba(99,102,241,.4)', yAxisID: 'y1' },
  ],
}));
const dualAxis = { scales: { y: { beginAtZero: true }, y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } } } } as any;

const barChart = (labelKey: string, valueKey: string, label: string) =>
  computed(() => ({
    labels: (Array.isArray(data.value) ? data.value : []).map((r: any) => r[labelKey] ?? '—'),
    datasets: [{ label, data: (Array.isArray(data.value) ? data.value : []).map((r: any) => r[valueKey]), backgroundColor: PALETTE }],
  }));
const routesChart = barChart('routeName', 'revenue', t('reports.revenue'));
const busesChart = barChart('plateNumber', 'utilization', t('reports.utilization'));
const driversChart = barChart('driverName', 'trips', t('reports.trips'));

const doughnut = (rows: any[] = [], labelKey: string, valueKey: string) => ({
  labels: rows.map((r) => (labelKey === 'status' ? t(`status.${r[labelKey]}`) : r[labelKey])),
  datasets: [{ data: rows.map((r) => r[valueKey]), backgroundColor: PALETTE }],
});

const hourChart = computed(() => ({
  labels: (data.value?.byHour ?? []).map((h: any) => `${String(h.hour).padStart(2, '0')}:00`),
  datasets: [
    { label: t('reports.trips'), data: (data.value?.byHour ?? []).map((h: any) => h.trips), backgroundColor: '#0f766e' },
    { label: t('reports.tickets'), data: (data.value?.byHour ?? []).map((h: any) => h.tickets), backgroundColor: '#6366f1' },
  ],
}));

const paymentSeries = computed(() => ({
  labels: (data.value?.series ?? []).map((s: any) => s.day.slice(5)),
  datasets: [
    { label: t('status.SUCCEEDED'), data: (data.value?.series ?? []).map((s: any) => s.succeeded), backgroundColor: '#10b981' },
    { label: t('status.FAILED'), data: (data.value?.series ?? []).map((s: any) => s.failed), backgroundColor: '#ef4444' },
    { label: t('status.REFUNDED'), data: (data.value?.series ?? []).map((s: any) => s.refunded), backgroundColor: '#f59e0b' },
  ],
}));
const stacked = { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } } as any;
</script>

<template>
  <div>
    <PageHeader :title="t('nav.reports')">
      <InputText v-model="range.from" type="date" class="w-40" />
      <InputText v-model="range.to" type="date" class="w-40" />
      <Button icon="pi pi-refresh" :label="t('common.apply')" :loading="loading" @click="load" />
      <Button icon="pi pi-download" outlined :label="t('common.exportCsv')" :disabled="!rowsOf.length" @click="downloadCsv(`report-${tab}-${range.from}-${range.to}`, rowsOf)" />
    </PageHeader>

    <Tabs v-model:value="tab" scrollable class="mb-4">
      <TabList>
        <Tab v-for="x in tabs" :key="x" :value="x">{{ t(`reports.${x}`) }}</Tab>
      </TabList>
    </Tabs>

    <div v-if="data" class="space-y-6">
      <template v-if="tab === 'sales'">
        <div class="flex justify-end"><SelectButton v-model="range.groupBy" :options="groupOptions" option-label="label" option-value="value" :allow-empty="false" /></div>
        <div class="card p-5"><ChartBox type="bar" :data="salesChart" :options="dualAxis" :height="340" /></div>
        <div class="card p-4">
          <DataTable :value="data.items" size="small" sort-field="period" :sort-order="-1">
            <Column field="period" :header="t('common.period')" sortable />
            <Column field="revenue" :header="t('reports.revenue')" sortable><template #body="{ data: r }">{{ money(r.revenue) }}</template></Column>
            <Column field="tickets" :header="t('reports.tickets')" sortable />
            <Column field="bookings" :header="t('reports.bookings')" sortable />
            <Column field="cancelled" :header="t('reports.cancelled')" sortable />
          </DataTable>
        </div>
      </template>

      <template v-else-if="tab === 'routes'">
        <div class="card p-5"><ChartBox type="bar" :data="routesChart" :height="300" :options="{ plugins: { legend: { display: false } } }" /></div>
        <div class="card p-4">
          <DataTable :value="data" size="small">
            <Column field="routeName" :header="t('admin.route')" sortable />
            <Column field="trips" :header="t('reports.trips')" sortable />
            <Column field="tickets" :header="t('reports.tickets')" sortable />
            <Column field="revenue" :header="t('reports.revenue')" sortable><template #body="{ data: r }">{{ money(r.revenue) }}</template></Column>
            <Column field="occupancy" :header="t('reports.occupancy')" sortable>
              <template #body="{ data: r }"><div class="flex items-center gap-2"><ProgressBar :value="r.occupancy" :show-value="false" style="height: 6px; width: 90px" /><span class="text-xs">{{ r.occupancy }}%</span></div></template>
            </Column>
          </DataTable>
        </div>
      </template>

      <template v-else-if="tab === 'buses'">
        <div class="card p-5"><ChartBox type="bar" :data="busesChart" :height="300" :options="{ plugins: { legend: { display: false } }, scales: { y: { max: 100, beginAtZero: true } } }" /></div>
        <div class="card p-4">
          <DataTable :value="data" size="small">
            <Column field="plateNumber" :header="t('admin.plate')" sortable />
            <Column field="trips" :header="t('reports.trips')" sortable />
            <Column field="seatCapacity" :header="t('admin.capacity')" sortable />
            <Column field="soldSeats" :header="t('admin.sold')" sortable />
            <Column field="utilization" :header="t('reports.utilization')" sortable />
            <Column field="hoursOnRoad" :header="t('reports.hoursOnRoad')" sortable />
            <Column field="revenue" :header="t('reports.revenue')" sortable><template #body="{ data: r }">{{ money(r.revenue) }}</template></Column>
          </DataTable>
        </div>
      </template>

      <template v-else-if="tab === 'drivers'">
        <div class="card p-5"><ChartBox type="bar" :data="driversChart" :height="300" :options="{ plugins: { legend: { display: false } } }" /></div>
        <div class="card p-4">
          <DataTable :value="data" size="small">
            <Column field="driverName" :header="t('admin.driver')" sortable />
            <Column field="trips" :header="t('reports.trips')" sortable />
            <Column field="completed" :header="t('status.COMPLETED')" sortable />
            <Column field="delayed" :header="t('reports.delayedTrips')" sortable />
            <Column field="avgDelayMin" :header="t('reports.avgDelay')" sortable />
            <Column field="passengers" :header="t('nav.passengers')" sortable />
            <Column field="revenue" :header="t('reports.revenue')" sortable><template #body="{ data: r }">{{ money(r.revenue) }}</template></Column>
          </DataTable>
        </div>
      </template>

      <template v-else-if="tab === 'trips'">
        <div class="grid gap-4 sm:grid-cols-2">
          <StatCard :label="t('reports.delayedTrips')" :value="data.delayed" icon="pi-hourglass" tone="amber" />
          <StatCard :label="t('reports.avgDelay')" :value="`${data.avgDelayMin} ${t('common.minutes')}`" icon="pi-clock" tone="rose" />
        </div>
        <div class="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div class="card p-5"><ChartBox type="doughnut" :data="doughnut(data.byStatus, 'status', 'count')" :height="300" /></div>
          <div class="card p-5"><h3 class="mb-3 font-semibold">{{ t('reports.byHour') }}</h3><ChartBox type="bar" :data="hourChart" :height="300" /></div>
        </div>
      </template>

      <template v-else-if="tab === 'payments'">
        <div class="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div class="card p-5"><ChartBox type="doughnut" :data="doughnut(data.byStatus, 'status', 'count')" :height="280" /></div>
          <div class="card p-5"><ChartBox type="bar" :data="paymentSeries" :options="stacked" :height="280" /></div>
        </div>
        <div class="card p-4">
          <DataTable :value="data.byStatus" size="small">
            <Column :header="t('common.status')"><template #body="{ data: r }">{{ t(`status.${r.status}`) }}</template></Column>
            <Column field="count" :header="t('reports.count')" />
            <Column :header="t('reports.amount')"><template #body="{ data: r }">{{ money(r.amount) }}</template></Column>
          </DataTable>
        </div>
      </template>

      <template v-else-if="tab === 'passengers'">
        <div class="grid gap-4 sm:grid-cols-4">
          <StatCard :label="t('reports.activePassengers')" :value="number(data.active)" icon="pi-users" />
          <StatCard :label="t('reports.newPassengers')" :value="number(data.new)" icon="pi-user-plus" tone="blue" />
          <StatCard :label="t('reports.returning')" :value="number(data.returning)" icon="pi-replay" tone="violet" />
          <StatCard :label="t('reports.tickets')" :value="number(data.tickets)" icon="pi-ticket" tone="amber" />
        </div>
        <div class="card p-4">
          <DataTable :value="data.top" size="small">
            <Column field="userId" header="ID"><template #body="{ data: r }"><span class="font-mono text-xs">{{ r.userId.slice(0, 8) }}</span></template></Column>
            <Column field="bookings" :header="t('reports.bookings')" />
            <Column field="tickets" :header="t('reports.tickets')" />
            <Column :header="t('reports.amount')"><template #body="{ data: r }">{{ money(r.spent) }}</template></Column>
          </DataTable>
        </div>
      </template>

      <template v-else-if="tab === 'cancellations'">
        <div class="grid gap-4 sm:grid-cols-3">
          <StatCard :label="t('reports.cancelled')" :value="data.cancelled" icon="pi-times-circle" tone="rose" />
          <StatCard :label="t('reports.bookings')" :value="data.total" icon="pi-ticket" />
          <StatCard :label="t('reports.rate')" :value="`${data.rate}%`" icon="pi-percentage" tone="amber" />
        </div>
        <div class="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div class="card p-5"><ChartBox type="doughnut" :data="doughnut(data.byReason, 'reason', 'count')" :height="280" /></div>
          <div class="card p-4">
            <DataTable :value="data.byReason" size="small">
              <Column field="reason" :header="t('common.reason')" />
              <Column field="count" :header="t('reports.count')" />
              <Column :header="t('reports.amount')"><template #body="{ data: r }">{{ money(r.amount) }}</template></Column>
            </DataTable>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
