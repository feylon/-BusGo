<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, onMounted, reactive, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api';
import { usePaged } from '@/composables/usePaged';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t, money, date } = useFormat();
const { success, error, ask } = useNotify();
const { items, total, rows, loading, query, load, onPage } = usePaged(api.pricing.list, { routeId: null, search: '' }, 50);
const routes = ref<any[]>([]);
const routeOptions = computed(() => [{ label: t('common.all'), value: null }, ...routes.value.map((r) => ({ label: r.name, value: r.id }))]);
const seatTypes = computed(() => [{ label: t('admin.anySeat'), value: null }, ...['STANDARD', 'COMFORT', 'VIP', 'ACCESSIBLE'].map((v) => ({ label: t(`seatType.${v}`), value: v }))]);

const dialog = ref(false);
const editing = ref<any>(null);
const form = reactive({ routeId: null as string | null, fromStopId: null as string | null, toStopId: null as string | null, seatType: null as string | null, price: 50000, validFrom: '', validTo: '', active: true });
const routeStops = computed(() => (routes.value.find((r) => r.id === form.routeId)?.stops ?? []).map((s: any) => ({ label: s.stop?.name, value: s.stopId })));

function openCreate() {
  editing.value = null;
  Object.assign(form, { routeId: query.routeId ?? routes.value[0]?.id ?? null, fromStopId: null, toStopId: null, seatType: null, price: 50000, validFrom: '', validTo: '', active: true });
  dialog.value = true;
}

function openEdit(p: any) {
  editing.value = p;
  Object.assign(form, {
    routeId: p.routeId,
    fromStopId: p.fromStopId,
    toStopId: p.toStopId,
    seatType: p.seatType,
    price: p.price,
    validFrom: p.validFrom?.slice(0, 10) ?? '',
    validTo: p.validTo?.slice(0, 10) ?? '',
    active: p.active,
  });
  dialog.value = true;
}

async function save() {
  try {
    const body = {
      fromStopId: form.fromStopId,
      toStopId: form.toStopId,
      seatType: form.seatType,
      price: form.price,
      active: form.active,
      validFrom: form.validFrom ? new Date(`${form.validFrom}T00:00:00+05:00`).toISOString() : null,
      validTo: form.validTo ? new Date(`${form.validTo}T23:59:59+05:00`).toISOString() : null,
    };
    if (editing.value) await api.pricing.update(editing.value.id, body);
    else await api.pricing.create({ ...body, routeId: form.routeId });
    dialog.value = false;
    success(t('common.saved'));
    load();
  } catch (e) {
    error(e);
  }
}

function remove(p: any) {
  ask(t('common.confirmDelete'), async () => {
    try {
      await api.pricing.remove(p.id);
      load();
    } catch (e) {
      error(e);
    }
  });
}

onMounted(async () => {
  load();
  routes.value = (await api.routes.list({ limit: 100 })).items;
});
</script>

<template>
  <div>
    <PageHeader :title="t('nav.pricing')">
      <Button :label="t('admin.addPrice')" icon="pi pi-plus" @click="openCreate" />
    </PageHeader>
    <div class="card p-4">
      <div class="mb-4 flex flex-wrap gap-3">
        <Select v-model="query.routeId" :options="routeOptions" option-label="label" option-value="value" class="w-64" />
        <InputText v-model="query.search" :placeholder="t('common.search')" class="w-60" />
      </div>
      <DataTable :value="items" :loading="loading" lazy paginator :rows="rows" :total-records="total" data-key="id" size="small" @page="onPage">
        <Column :header="t('admin.route')"><template #body="{ data }">{{ data.route?.name }}</template></Column>
        <Column :header="t('common.from')"><template #body="{ data }">{{ data.fromStop?.city }}</template></Column>
        <Column :header="t('common.to')"><template #body="{ data }">{{ data.toStop?.city }}</template></Column>
        <Column :header="t('admin.seatType')"><template #body="{ data }">{{ data.seatType ? t(`seatType.${data.seatType}`) : t('admin.anySeat') }}</template></Column>
        <Column :header="t('common.price')"><template #body="{ data }"><span class="font-semibold">{{ money(data.price) }}</span></template></Column>
        <Column :header="t('common.period')"><template #body="{ data }"><span class="muted text-xs">{{ data.validFrom ? date(data.validFrom) : '∞' }} — {{ data.validTo ? date(data.validTo) : '∞' }}</span></template></Column>
        <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.active ? 'ACTIVE' : 'INACTIVE'" /></template></Column>
        <Column :header="t('common.actions')" class="w-28">
          <template #body="{ data }">
            <Button icon="pi pi-pencil" text rounded size="small" @click="openEdit(data)" />
            <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="remove(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="dialog" modal :header="editing ? t('common.edit') : t('admin.addPrice')" class="w-full max-w-lg">
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="sm:col-span-2"><label class="field-label">{{ t('admin.route') }}</label><Select v-model="form.routeId" :options="routes" option-label="name" option-value="id" class="w-full" :disabled="!!editing" /></div>
        <div><label class="field-label">{{ t('admin.fromStop') }}</label><Select v-model="form.fromStopId" :options="routeStops" option-label="label" option-value="value" class="w-full" /></div>
        <div><label class="field-label">{{ t('admin.toStop') }}</label><Select v-model="form.toStopId" :options="routeStops" option-label="label" option-value="value" class="w-full" /></div>
        <div><label class="field-label">{{ t('admin.seatType') }}</label><Select v-model="form.seatType" :options="seatTypes" option-label="label" option-value="value" class="w-full" /></div>
        <div><label class="field-label">{{ t('common.price') }}</label><InputNumber v-model="form.price" :min="0" :step="1000" class="w-full" /></div>
        <div><label class="field-label">{{ t('admin.validFrom') }}</label><InputText v-model="form.validFrom" type="date" class="w-full" /></div>
        <div><label class="field-label">{{ t('admin.validTo') }}</label><InputText v-model="form.validTo" type="date" class="w-full" /></div>
        <label class="flex items-center gap-2 text-sm"><ToggleSwitch v-model="form.active" /> {{ t('common.active') }}</label>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="dialog = false" />
        <Button :label="t('common.save')" icon="pi pi-check" :disabled="!form.fromStopId || !form.toStopId" @click="save" />
      </template>
    </Dialog>
  </div>
</template>
