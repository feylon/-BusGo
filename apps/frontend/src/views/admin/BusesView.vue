<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import MultiSelect from 'primevue/multiselect';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { buildStandardLayout } from '@bus/types';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api';
import { usePaged } from '@/composables/usePaged';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t } = useFormat();
const { success, error, ask } = useNotify();
const router = useRouter();
const { items, total, rows, loading, query, load, onPage } = usePaged(api.buses.list, { search: '', status: null });
const statusOptions = computed(() => ['ACTIVE', 'INACTIVE', 'MAINTENANCE'].map((s) => ({ label: t(`status.${s}`), value: s })));
const filterStatus = computed(() => [{ label: t('common.all'), value: null }, ...statusOptions.value]);
const amenityOptions = computed(() => ['WIFI', 'AC', 'USB', 'TV', 'WC'].map((a) => ({ label: t(`amenities.${a}`), value: a })));

const dialog = ref(false);
const editing = ref<any>(null);
const form = reactive({ name: '', model: '', plateNumber: '', busNumber: '', amenities: ['AC'] as string[], status: 'ACTIVE', rows: 12, left: 2, right: 2 });

function openCreate() {
  editing.value = null;
  Object.assign(form, { name: '', model: '', plateNumber: '', busNumber: '', amenities: ['AC'], status: 'ACTIVE', rows: 12, left: 2, right: 2 });
  dialog.value = true;
}

function openEdit(b: any) {
  editing.value = b;
  Object.assign(form, { name: b.name, model: b.model, plateNumber: b.plateNumber, busNumber: b.busNumber ?? '', amenities: [...b.amenities], status: b.status });
  dialog.value = true;
}

async function save() {
  try {
    const body = { name: form.name, model: form.model, plateNumber: form.plateNumber, busNumber: form.busNumber || undefined, amenities: form.amenities, status: form.status };
    if (editing.value) await api.buses.update(editing.value.id, body);
    else {
      const bus = await api.buses.create({ ...body, layout: buildStandardLayout(form.rows, form.left, form.right) });
      router.push(`/admin/buses/${bus.id}/seats`);
    }
    dialog.value = false;
    success(t('common.saved'));
    load();
  } catch (e) {
    error(e);
  }
}

function remove(b: any) {
  ask(t('common.confirmDelete'), async () => {
    try {
      await api.buses.remove(b.id);
      success(t('common.deleted'));
      load();
    } catch (e) {
      error(e);
    }
  });
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader :title="t('nav.buses')">
      <Button :label="t('admin.addBus')" icon="pi pi-plus" @click="openCreate" />
    </PageHeader>
    <div class="card p-4">
      <div class="mb-4 flex flex-wrap gap-3">
        <IconField class="w-full md:w-72">
          <InputIcon class="pi pi-search" />
          <InputText v-model="query.search" :placeholder="t('common.search')" class="w-full" />
        </IconField>
        <Select v-model="query.status" :options="filterStatus" option-label="label" option-value="value" class="w-44" />
      </div>
      <DataTable :value="items" :loading="loading" lazy paginator :rows="rows" :total-records="total" data-key="id" @page="onPage">
        <Column field="name" :header="t('common.name')" />
        <Column field="model" :header="t('admin.model')" />
        <Column :header="t('admin.plate')"><template #body="{ data }"><span class="rounded border px-2 py-0.5 font-mono text-sm" style="border-color: var(--app-border)">{{ data.plateNumber }}</span></template></Column>
        <Column field="busNumber" :header="t('admin.busNumber')" />
        <Column field="capacity" :header="t('admin.capacity')" />
        <Column :header="t('admin.amenities')">
          <template #body="{ data }"><span class="muted text-xs">{{ data.amenities.map((a: string) => t(`amenities.${a}`)).join(', ') }}</span></template>
        </Column>
        <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.status" /></template></Column>
        <Column :header="t('common.actions')" class="w-40">
          <template #body="{ data }">
            <Button v-tooltip="t('admin.editSeats')" icon="pi pi-th-large" text rounded size="small" @click="router.push(`/admin/buses/${data.id}/seats`)" />
            <Button icon="pi pi-pencil" text rounded size="small" @click="openEdit(data)" />
            <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="remove(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="dialog" modal :header="editing ? t('common.edit') : t('admin.addBus')" class="w-full max-w-lg">
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="sm:col-span-2"><label class="field-label">{{ t('common.name') }}</label><InputText v-model="form.name" class="w-full" /></div>
        <div><label class="field-label">{{ t('admin.model') }}</label><InputText v-model="form.model" class="w-full" /></div>
        <div><label class="field-label">{{ t('admin.plate') }}</label><InputText v-model="form.plateNumber" class="w-full uppercase" /></div>
        <div><label class="field-label">{{ t('admin.busNumber') }}</label><InputText v-model="form.busNumber" class="w-full" /></div>
        <div><label class="field-label">{{ t('common.status') }}</label><Select v-model="form.status" :options="statusOptions" option-label="label" option-value="value" class="w-full" /></div>
        <div class="sm:col-span-2"><label class="field-label">{{ t('admin.amenities') }}</label><MultiSelect v-model="form.amenities" :options="amenityOptions" option-label="label" option-value="value" class="w-full" display="chip" /></div>
        <template v-if="!editing">
          <div><label class="field-label">{{ t('seatEditor.rows') }}</label><InputNumber v-model="form.rows" :min="2" :max="20" class="w-full" /></div>
          <div class="grid grid-cols-2 gap-2">
            <div><label class="field-label">{{ t('seatEditor.left') }}</label><InputNumber v-model="form.left" :min="1" :max="3" class="w-full" /></div>
            <div><label class="field-label">{{ t('seatEditor.right') }}</label><InputNumber v-model="form.right" :min="1" :max="3" class="w-full" /></div>
          </div>
        </template>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="dialog = false" />
        <Button :label="t('common.save')" icon="pi pi-check" @click="save" />
      </template>
    </Dialog>
  </div>
</template>
