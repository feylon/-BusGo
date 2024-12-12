<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import Menu from 'primevue/menu';
import ProgressBar from 'primevue/progressbar';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import { computed, onMounted, reactive, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import SeatMap from '@/components/SeatMap.vue';
import SeatLegend from '@/components/SeatLegend.vue';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { usePaged } from '@/composables/usePaged';
import { fromLocalInput, toLocalInput, todayIso, useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t, dt, money, phone } = useFormat();
const { success, error, ask } = useNotify();
const auth = useAuthStore();
const { items, total, rows, loading, query, load, onPage } = usePaged(api.trips.list, { search: '', status: null, routeId: null, date: todayIso() });

const routes = ref<any[]>([]);
const buses = ref<any[]>([]);
const drivers = ref<any[]>([]);
const statusOptions = computed(() => [
  { label: t('common.all'), value: null },
  ...['SCHEDULED', 'BOARDING', 'IN_PROGRESS', 'DELAYED', 'COMPLETED', 'CANCELLED'].map((s) => ({ label: t(`status.${s}`), value: s })),
]);
const routeOptions = computed(() => [{ label: t('common.all'), value: null }, ...routes.value.map((r) => ({ label: r.name, value: r.id }))]);
const driverOptions = computed(() => drivers.value.map((d) => ({ label: `${d.fullName} · ${d.licenseNumber}`, value: d.id })));
const busOptions = computed(() => buses.value.map((b) => ({ label: `${b.name} · ${b.plateNumber} (${b.capacity})`, value: b.id })));

const createDialog = ref(false);
const form = reactive({ routeId: null as string | null, busId: null as string | null, driverId: null as string | null, departureAt: '', price: 80000, days: 1 });
const editing = ref<any>(null);

const assignDialog = ref(false);
const assign = reactive({ tripId: '', driverId: null as string | null });
const delayDialog = ref(false);
const delayForm = reactive({ tripId: '', minutes: 30, reason: '' });
const passengersDialog = ref(false);
const passengers = ref<any[]>([]);
const seatDialog = ref(false);
const seatMap = ref<any>(null);
const current = ref<any>(null);
const menu = ref();

function openCreate() {
  editing.value = null;
  const dep = new Date(Date.now() + 86400000);
  dep.setMinutes(0, 0, 0);
  Object.assign(form, { routeId: routes.value[0]?.id ?? null, busId: null, driverId: null, departureAt: toLocalInput(dep), price: 80000, days: 1 });
  createDialog.value = true;
}

function openEdit(trip: any) {
  editing.value = trip;
  Object.assign(form, { routeId: trip.routeId, busId: trip.busId, driverId: trip.driverId, departureAt: toLocalInput(trip.departureAt), price: trip.price, days: 1 });
  createDialog.value = true;
}

async function save() {
  try {
    const body: any = { routeId: form.routeId, busId: form.busId, departureAt: fromLocalInput(form.departureAt), price: form.price, ...(form.driverId ? { driverId: form.driverId } : {}) };
    if (editing.value) {
      await api.trips.update(editing.value.id, { busId: body.busId, driverId: form.driverId, departureAt: body.departureAt, price: body.price });
      success(t('common.saved'));
    } else if (form.days > 1) {
      const res = await api.trips.generate({ ...body, days: form.days });
      success(`${t('admin.created', { n: res.created })} · ${t('admin.skipped', { n: res.skipped.length })}`);
    } else {
      await api.trips.create(body);
      success(t('common.saved'));
    }
    createDialog.value = false;
    load();
  } catch (e) {
    error(e);
  }
}

async function run(fn: () => Promise<unknown>) {
  try {
    await fn();
    success(t('common.saved'));
    load();
  } catch (e) {
    error(e);
  }
}

function saveAssign() {
  assignDialog.value = false;
  run(() => api.trips.assignDriver(assign.tripId, assign.driverId!));
}

function saveDelay() {
  delayDialog.value = false;
  run(() => api.trips.delay(delayForm.tripId, delayForm.minutes, delayForm.reason || undefined));
}

async function showPassengers(trip: any) {
  current.value = trip;
  passengers.value = await api.trips.passengers(trip.id);
  passengersDialog.value = true;
}

async function showSeats(trip: any) {
  current.value = trip;
  seatMap.value = await api.trips.seats(trip.id);
  seatDialog.value = true;
}

const actions = computed(() => {
  const trip = current.value;
  if (!trip) return [];
  const s = trip.status;
  const can = (p: string) => auth.can(p);
  return [
    { label: t('admin.passengerList'), icon: 'pi pi-users', command: () => showPassengers(trip) },
    { label: t('trip.seatMap'), icon: 'pi pi-th-large', command: () => showSeats(trip) },
    { label: t('common.open'), icon: 'pi pi-external-link', command: () => window.open(`/trip/${trip.id}`, '_blank') },
    { separator: true },
    ...(can('trips.update') && ['SCHEDULED', 'DELAYED', 'BOARDING'].includes(s)
      ? [
          { label: t('common.edit'), icon: 'pi pi-pencil', command: () => openEdit(trip) },
          { label: t('admin.assignDriver'), icon: 'pi pi-id-card', command: () => { Object.assign(assign, { tripId: trip.id, driverId: trip.driverId }); assignDialog.value = true; } },
        ]
      : []),
    ...(can('trips.update') && ['SCHEDULED', 'DELAYED'].includes(s) ? [{ label: t('admin.boarding'), icon: 'pi pi-sign-in', command: () => run(() => api.trips.boarding(trip.id)) }] : []),
    ...(can('trips.update') && ['SCHEDULED', 'BOARDING', 'DELAYED'].includes(s) ? [{ label: t('admin.start'), icon: 'pi pi-play', command: () => run(() => api.trips.start(trip.id)) }] : []),
    ...(can('trips.update') && ['SCHEDULED', 'BOARDING', 'DELAYED', 'IN_PROGRESS'].includes(s)
      ? [{ label: t('admin.delay'), icon: 'pi pi-hourglass', command: () => { Object.assign(delayForm, { tripId: trip.id, minutes: trip.delayMinutes || 30, reason: '' }); delayDialog.value = true; } }]
      : []),
    ...(can('trips.update') && s === 'IN_PROGRESS' ? [{ label: t('admin.complete'), icon: 'pi pi-flag-fill', command: () => run(() => api.trips.complete(trip.id)) }] : []),
    ...(can('trips.cancel') && ['SCHEDULED', 'BOARDING', 'DELAYED'].includes(s)
      ? [{ label: t('admin.cancelTrip'), icon: 'pi pi-ban', class: 'text-rose-600', command: () => ask(t('admin.cancelTripConfirm'), () => run(() => api.trips.cancel(trip.id, 'CANCELLED_BY_DISPATCHER'))) }]
      : []),
  ];
});

function openMenu(e: Event, trip: any) {
  current.value = trip;
  menu.value?.toggle(e);
}

onMounted(async () => {
  load();
  const [r, b, d] = await Promise.all([api.routes.list({ limit: 100 }), api.buses.list({ limit: 100, status: 'ACTIVE' }), api.drivers.list({ limit: 100, status: 'ACTIVE' })]);
  routes.value = r.items;
  buses.value = b.items;
  drivers.value = d.items;
});
</script>

<template>
  <div>
    <PageHeader :title="t('nav.trips')">
      <Button v-if="auth.can('trips.create')" :label="t('admin.addTrip')" icon="pi pi-plus" @click="openCreate" />
    </PageHeader>
    <div class="card p-4">
      <div class="mb-4 flex flex-wrap gap-3">
        <IconField class="w-full md:w-60">
          <InputIcon class="pi pi-search" />
          <InputText v-model="query.search" :placeholder="t('common.search')" class="w-full" />
        </IconField>
        <InputText v-model="query.date" type="date" class="w-44" />
        <Select v-model="query.routeId" :options="routeOptions" option-label="label" option-value="value" class="w-56" />
        <Select v-model="query.status" :options="statusOptions" option-label="label" option-value="value" class="w-44" />
        <Button icon="pi pi-refresh" text @click="load" />
      </div>
      <DataTable :value="items" :loading="loading" lazy paginator :rows="rows" :total-records="total" data-key="id" size="small" @page="onPage">
        <Column :header="t('admin.departureAt')"><template #body="{ data }"><span class="font-medium">{{ dt(data.departureAt) }}</span></template></Column>
        <Column :header="t('admin.route')"><template #body="{ data }">{{ data.route?.name }}</template></Column>
        <Column :header="t('admin.bus')"><template #body="{ data }"><span class="font-mono text-xs">{{ data.bus?.plateNumber }}</span></template></Column>
        <Column :header="t('admin.driver')"><template #body="{ data }">{{ data.driver?.user?.fullName ?? '—' }}</template></Column>
        <Column :header="t('admin.sold')">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <ProgressBar :value="data.seats.total ? Math.round(((data.seats.sold + data.seats.reserved) / data.seats.total) * 100) : 0" :show-value="false" style="height: 6px; width: 70px" />
              <span class="text-xs">{{ data.seats.sold }}/{{ data.seats.total }}</span>
            </div>
          </template>
        </Column>
        <Column :header="t('common.price')"><template #body="{ data }">{{ money(data.price) }}</template></Column>
        <Column :header="t('common.status')">
          <template #body="{ data }">
            <StatusBadge :status="data.status" />
            <span v-if="data.delayMinutes" class="ml-1 text-xs text-amber-600">+{{ data.delayMinutes }}′</span>
          </template>
        </Column>
        <Column class="w-14"><template #body="{ data }"><Button icon="pi pi-ellipsis-v" text rounded size="small" @click="openMenu($event, data)" /></template></Column>
      </DataTable>
      <Menu ref="menu" :model="actions" popup />
    </div>

    <Dialog v-model:visible="createDialog" modal :header="editing ? t('common.edit') : t('admin.addTrip')" class="w-full max-w-lg">
      <div class="grid gap-3">
        <div><label class="field-label">{{ t('admin.route') }}</label><Select v-model="form.routeId" :options="routes" option-label="name" option-value="id" filter class="w-full" :disabled="!!editing" /></div>
        <div><label class="field-label">{{ t('admin.bus') }}</label><Select v-model="form.busId" :options="busOptions" option-label="label" option-value="value" filter class="w-full" /></div>
        <div><label class="field-label">{{ t('admin.driver') }}</label><Select v-model="form.driverId" :options="driverOptions" option-label="label" option-value="value" filter show-clear class="w-full" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="field-label">{{ t('admin.departureAt') }}</label><InputText v-model="form.departureAt" type="datetime-local" class="w-full" /></div>
          <div><label class="field-label">{{ t('admin.basePrice') }}</label><InputNumber v-model="form.price" :min="0" :step="1000" class="w-full" /></div>
        </div>
        <div v-if="!editing"><label class="field-label">{{ t('admin.repeatDays') }}</label><InputNumber v-model="form.days" :min="1" :max="60" show-buttons class="w-full" /></div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="createDialog = false" />
        <Button :label="t('common.save')" icon="pi pi-check" :disabled="!form.routeId || !form.busId || !form.departureAt" @click="save" />
      </template>
    </Dialog>

    <Dialog v-model:visible="assignDialog" modal :header="t('admin.assignDriver')" class="w-full max-w-md">
      <Select v-model="assign.driverId" :options="driverOptions" option-label="label" option-value="value" filter class="w-full" />
      <template #footer>
        <Button :label="t('common.cancel')" text @click="assignDialog = false" />
        <Button :label="t('common.save')" :disabled="!assign.driverId" @click="saveAssign" />
      </template>
    </Dialog>

    <Dialog v-model:visible="delayDialog" modal :header="t('admin.delay')" class="w-full max-w-md">
      <div class="space-y-3">
        <div><label class="field-label">{{ t('admin.delayMinutes') }}</label><InputNumber v-model="delayForm.minutes" :min="1" :max="1440" show-buttons class="w-full" /></div>
        <div><label class="field-label">{{ t('common.reason') }}</label><InputText v-model="delayForm.reason" class="w-full" /></div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="delayDialog = false" />
        <Button :label="t('common.save')" @click="saveDelay" />
      </template>
    </Dialog>

    <Dialog v-model:visible="passengersDialog" modal :header="`${t('admin.passengerList')} · ${current?.route?.name ?? ''}`" class="w-full max-w-4xl">
      <DataTable :value="passengers" size="small">
        <Column field="seatNumber" :header="t('common.seat')" />
        <Column :header="t('common.fullName')"><template #body="{ data }">{{ data.passenger?.fullName }}</template></Column>
        <Column :header="t('common.phone')"><template #body="{ data }">{{ phone(data.passenger?.phone) }}</template></Column>
        <Column :header="t('common.from')"><template #body="{ data }">{{ data.from }} → {{ data.to }}</template></Column>
        <Column field="bookingCode" :header="t('booking.code')" />
        <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.ticket?.status ?? data.bookingStatus" /></template></Column>
      </DataTable>
    </Dialog>

    <Dialog v-model:visible="seatDialog" modal :header="t('trip.seatMap')" class="w-auto">
      <div v-if="seatMap" class="flex flex-col items-center gap-4">
        <SeatMap :rows="seatMap.layout.rows" :cols="seatMap.layout.cols" :seats="seatMap.seats" :fixtures="seatMap.layout.fixtures" />
        <SeatLegend />
      </div>
    </Dialog>
  </div>
</template>
