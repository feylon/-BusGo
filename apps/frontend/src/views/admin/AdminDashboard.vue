<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import ProgressBar from 'primevue/progressbar';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import StatCard from '@/components/StatCard.vue';
import ChartBox from '@/components/ChartBox.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useFormat } from '@/composables/useFormat';

const { t, money, number, dt } = useFormat();
const auth = useAuthStore();
const live = ref<any>(null);
const report = ref<any>(null);
const health = ref<any>(null);
let timer: ReturnType<typeof setInterval>;

async function load() {
  const [l, r] = await Promise.all([api.reports.live(), api.reports.get('dashboard').catch(() => null)]);
  live.value = l;
  report.value = r;
  if (auth.can('settings.manage')) health.value = await api.health.services().catch(() => null);
}

onMounted(() => {
  load();
  timer = setInterval(load, 30000);
});
onBeforeUnmount(() => clearInterval(timer));

const revenueChart = computed(() => ({
  labels: (report.value?.series ?? []).map((s: any) => s.period.slice(5)),
  datasets: [
    { type: 'line', label: t('reports.revenue'), data: (report.value?.series ?? []).map((s: any) => s.revenue), borderColor: '#0f766e', backgroundColor: 'rgba(15,118,110,0.12)', fill: true, tension: 0.35, yAxisID: 'y' },
    { type: 'bar', label: t('reports.tickets'), data: (report.value?.series ?? []).map((s: any) => s.tickets), backgroundColor: 'rgba(14,165,233,0.35)', yAxisID: 'y1' },
  ],
}));
const revenueOptions = { scales: { y: { beginAtZero: true }, y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } } } } as any;

const routesChart = computed(() => ({
  labels: (report.value?.topRoutes ?? []).map((r: any) => r.routeName),
  datasets: [{ label: t('reports.revenue'), data: (report.value?.topRoutes ?? []).map((r: any) => r.revenue), backgroundColor: ['#0f766e', '#0891b2', '#6366f1', '#f59e0b', '#ec4899'] }],
}));
</script>

<template>
  <div>
    <PageHeader :title="t('nav.overview')" :subtitle="report ? `${report.range.from} — ${report.range.to}` : ''" />
    <div v-if="live" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard :label="t('dashboard.todayTrips')" :value="live.todayTrips" icon="pi-calendar" />
      <StatCard :label="t('dashboard.activeTrips')" :value="live.activeTrips" icon="pi-car" tone="blue" :hint="`${t('dashboard.delayed')}: ${live.delayed}`" />
      <StatCard :label="t('dashboard.todaySales')" :value="live.todayBookings" icon="pi-ticket" tone="violet" :hint="`${t('dashboard.pending')}: ${live.pendingBookings}`" />
      <StatCard :label="t('dashboard.todayRevenue')" :value="money(live.todayRevenue)" icon="pi-wallet" tone="amber" />
    </div>

    <div v-if="report" class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard :label="t('dashboard.revenue30')" :value="money(report.revenue)" icon="pi-chart-line" tone="teal" />
      <StatCard :label="t('reports.tickets')" :value="number(report.tickets)" icon="pi-qrcode" tone="blue" :hint="`${t('reports.avgTicket')}: ${money(report.avgTicketPrice)}`" />
      <StatCard :label="t('dashboard.occupancy')" :value="`${report.trips.occupancy}%`" icon="pi-percentage" tone="violet" :hint="`${t('reports.trips')}: ${report.trips.total}`" />
      <StatCard :label="t('reports.cancelled')" :value="report.cancelled" icon="pi-times-circle" tone="rose" :hint="`${t('reports.successRate')}: ${report.payments.successRate}%`" />
    </div>

    <div class="mt-6 grid gap-6 xl:grid-cols-3">
      <div class="card p-5 xl:col-span-2">
        <h3 class="mb-4 font-semibold">{{ t('dashboard.revenue30') }}</h3>
        <ChartBox type="bar" :data="revenueChart" :options="revenueOptions" :height="300" />
      </div>
      <div class="card p-5">
        <h3 class="mb-4 font-semibold">{{ t('dashboard.topRoutes') }}</h3>
        <ChartBox type="doughnut" :data="routesChart" :height="300" />
      </div>
    </div>

    <div class="mt-6 grid gap-6 xl:grid-cols-3">
      <div class="card p-5 xl:col-span-2">
        <h3 class="mb-4 font-semibold">{{ t('dashboard.upcoming') }}</h3>
        <DataTable :value="live?.upcoming ?? []" size="small">
          <Column :header="t('admin.departureAt')"><template #body="{ data }">{{ dt(data.departureAt) }}</template></Column>
          <Column field="route" :header="t('admin.route')" />
          <Column field="plateNumber" :header="t('admin.plate')" />
          <Column :header="t('admin.sold')">
            <template #body="{ data }">
              <div class="flex items-center gap-2">
                <ProgressBar :value="data.total ? Math.round((data.sold / data.total) * 100) : 0" :show-value="false" style="height: 6px; width: 80px" />
                <span class="text-xs">{{ data.sold }}/{{ data.total }}</span>
              </div>
            </template>
          </Column>
          <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.status" /></template></Column>
        </DataTable>
      </div>
      <div v-if="health" class="card p-5">
        <h3 class="mb-4 font-semibold">{{ t('dashboard.services') }}</h3>
        <div class="space-y-2">
          <div v-for="s in health.services" :key="s.name" class="flex items-center justify-between text-sm">
            <span class="font-mono">{{ s.name }}</span>
            <span class="flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full" :class="s.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'" />
              {{ s.status }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
