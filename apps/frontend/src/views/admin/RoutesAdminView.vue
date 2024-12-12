<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import { computed, onMounted, reactive, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import TripMap from '@/components/TripMap.vue';
import { api } from '@/api';
import { usePaged } from '@/composables/usePaged';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t, duration } = useFormat();
const { success, error, ask } = useNotify();
const { items, total, rows, loading, query, load, onPage } = usePaged(api.routes.list, { search: '' });
const stops = ref<any[]>([]);
const stopOptions = computed(() => stops.value.map((s) => ({ label: `${s.name} · ${s.city}`, value: s.id })));

const dialog = ref(false);
const editing = ref<any>(null);
const form = reactive({
  name: '',
  code: '',
  active: true,
  stops: [] as { stopId: string | null; arrivalOffsetMin: number; departureOffsetMin: number }[],
});
const preview = computed(() =>
  form.stops
    .map((s) => stops.value.find((x) => x.id === s.stopId))
    .filter(Boolean)
    .map((s) => ({ name: s.name, latitude: s.latitude, longitude: s.longitude })),
);

function openCreate() {
  editing.value = null;
  Object.assign(form, { name: '', code: '', active: true, stops: [{ stopId: null, arrivalOffsetMin: 0, departureOffsetMin: 0 }, { stopId: null, arrivalOffsetMin: 120, departureOffsetMin: 120 }] });
  dialog.value = true;
}

function openEdit(r: any) {
  editing.value = r;
  Object.assign(form, {
    name: r.name,
    code: r.code,
    active: r.active,
    stops: r.stops.map((s: any) => ({ stopId: s.stopId, arrivalOffsetMin: s.arrivalOffsetMin, departureOffsetMin: s.departureOffsetMin })),
  });
  dialog.value = true;
}

function addStop() {
  const last = form.stops[form.stops.length - 1];
  form.stops.push({ stopId: null, arrivalOffsetMin: (last?.departureOffsetMin ?? 0) + 60, departureOffsetMin: (last?.departureOffsetMin ?? 0) + 70 });
}

function move(i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= form.stops.length) return;
  [form.stops[i], form.stops[j]] = [form.stops[j], form.stops[i]];
}

async function save() {
  try {
    const body = { name: form.name, code: form.code, active: form.active, stops: form.stops.filter((s) => s.stopId) };
    if (editing.value) await api.routes.update(editing.value.id, body);
    else await api.routes.create(body);
    dialog.value = false;
    success(t('common.saved'));
    load();
  } catch (e) {
    error(e);
  }
}

function remove(r: any) {
  ask(t('common.confirmDelete'), async () => {
    try {
      await api.routes.remove(r.id);
      success(t('common.deleted'));
      load();
    } catch (e) {
      error(e);
    }
  });
}

onMounted(async () => {
  load();
  stops.value = (await api.stops.list({ limit: 500 })).items;
});
</script>

<template>
  <div>
    <PageHeader :title="t('nav.routes')">
      <Button :label="t('admin.addRoute')" icon="pi pi-plus" @click="openCreate" />
    </PageHeader>
    <div class="card p-4">
      <IconField class="mb-4 w-full md:w-72">
        <InputIcon class="pi pi-search" />
        <InputText v-model="query.search" :placeholder="t('common.search')" class="w-full" />
      </IconField>
      <DataTable :value="items" :loading="loading" lazy paginator :rows="rows" :total-records="total" data-key="id" @page="onPage">
        <Column field="code" :header="t('common.code')"><template #body="{ data }"><span class="font-mono font-semibold">{{ data.code }}</span></template></Column>
        <Column field="name" :header="t('common.name')" />
        <Column :header="t('trip.stops')"><template #body="{ data }"><span class="muted text-xs">{{ data.stops.map((s: any) => s.stop?.city).join(' → ') }}</span></template></Column>
        <Column :header="t('admin.distance')"><template #body="{ data }">{{ Math.round(data.distanceKm) }} {{ t('common.km') }}</template></Column>
        <Column :header="t('search.duration')"><template #body="{ data }">{{ duration(data.durationMin) }}</template></Column>
        <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.active ? 'ACTIVE' : 'INACTIVE'" /></template></Column>
        <Column :header="t('common.actions')" class="w-28">
          <template #body="{ data }">
            <Button icon="pi pi-pencil" text rounded size="small" @click="openEdit(data)" />
            <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="remove(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="dialog" modal :header="editing ? t('common.edit') : t('admin.addRoute')" class="w-full max-w-4xl">
      <div class="grid gap-5 lg:grid-cols-2">
        <div class="space-y-3">
          <div class="grid grid-cols-[1fr_140px] gap-3">
            <div><label class="field-label">{{ t('common.name') }}</label><InputText v-model="form.name" class="w-full" /></div>
            <div><label class="field-label">{{ t('common.code') }}</label><InputText v-model="form.code" class="w-full uppercase" /></div>
          </div>
          <label class="flex items-center gap-2 text-sm"><ToggleSwitch v-model="form.active" /> {{ t('common.active') }}</label>
          <div class="field-label">{{ t('admin.routeStops') }}</div>
          <div v-for="(s, i) in form.stops" :key="i" class="grid grid-cols-[1fr_80px_80px_auto] items-end gap-2">
            <div>
              <label v-if="i === 0" class="muted text-xs">{{ t('nav.stops') }}</label>
              <Select v-model="s.stopId" :options="stopOptions" option-label="label" option-value="value" filter class="w-full" />
            </div>
            <div>
              <label v-if="i === 0" class="muted text-xs">{{ t('admin.arrivalOffset') }}</label>
              <InputNumber v-model="s.arrivalOffsetMin" :min="0" class="w-full" input-class="w-full" />
            </div>
            <div>
              <label v-if="i === 0" class="muted text-xs">{{ t('admin.departureOffset') }}</label>
              <InputNumber v-model="s.departureOffsetMin" :min="0" class="w-full" input-class="w-full" />
            </div>
            <div class="flex">
              <Button icon="pi pi-arrow-up" text size="small" :disabled="i === 0" @click="move(i, -1)" />
              <Button icon="pi pi-times" text size="small" severity="danger" :disabled="form.stops.length <= 2" @click="form.stops.splice(i, 1)" />
            </div>
          </div>
          <Button size="small" outlined icon="pi pi-plus" :label="t('admin.addStopRow')" @click="addStop" />
        </div>
        <div class="overflow-hidden rounded-xl"><TripMap :stops="preview" height="380px" /></div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="dialog = false" />
        <Button :label="t('common.save')" icon="pi pi-check" @click="save" />
      </template>
    </Dialog>
  </div>
</template>
