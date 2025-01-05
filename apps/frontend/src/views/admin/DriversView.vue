<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Password from 'primevue/password';
import Select from 'primevue/select';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import { computed, onMounted, reactive, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api';
import { usePaged } from '@/composables/usePaged';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t, phone, dt } = useFormat();
const { success, error } = useNotify();
const { items, total, rows, loading, query, load, onPage } = usePaged(api.drivers.list, { search: '', status: null });
const statusOptions = computed(() => ['ACTIVE', 'ON_LEAVE', 'INACTIVE'].map((s) => ({ label: t(`status.${s}`), value: s })));
const filterStatus = computed(() => [{ label: t('common.all'), value: null }, ...statusOptions.value]);

const dialog = ref(false);
const editing = ref<any>(null);
const details = ref<any>(null);
const form = reactive({ fullName: '', phone: '+998', password: '', licenseNumber: '', licenseCategory: 'D', experienceYears: 0, status: 'ACTIVE' });

function openCreate() {
  editing.value = null;
  Object.assign(form, { fullName: '', phone: '+998', password: '', licenseNumber: '', licenseCategory: 'D', experienceYears: 0, status: 'ACTIVE' });
  dialog.value = true;
}

function openEdit(d: any) {
  editing.value = d;
  Object.assign(form, { fullName: d.fullName, phone: `+${d.phone}`, password: '', licenseNumber: d.licenseNumber, licenseCategory: d.licenseCategory ?? 'D', experienceYears: d.experienceYears, status: d.status });
  dialog.value = true;
}

async function save() {
  try {
    if (editing.value) {
      const { phone: _p, password, ...rest } = form;
      await api.drivers.update(editing.value.id, { ...rest, ...(password ? { password } : {}) });
    } else {
      const { status: _s, ...rest } = form;
      await api.drivers.create(rest);
    }
    dialog.value = false;
    success(t('common.saved'));
    load();
  } catch (e) {
    error(e);
  }
}

async function show(d: any) {
  details.value = await api.drivers.get(d.id);
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader :title="t('nav.drivers')">
      <Button :label="t('admin.addDriver')" icon="pi pi-plus" @click="openCreate" />
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
        <Column field="fullName" :header="t('common.fullName')" />
        <Column :header="t('common.phone')"><template #body="{ data }">{{ phone(data.phone) }}</template></Column>
        <Column :header="t('admin.license')"><template #body="{ data }">{{ data.licenseNumber }} <span class="muted">({{ data.licenseCategory }})</span></template></Column>
        <Column field="experienceYears" :header="t('admin.experience')" />
        <Column :header="t('admin.currentTrip')">
          <template #body="{ data }">
            <span v-if="data.currentTrip" class="text-sm">{{ data.currentTrip.route?.name }} <StatusBadge :status="data.currentTrip.status" /></span>
            <span v-else class="muted">—</span>
          </template>
        </Column>
        <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.status" /></template></Column>
        <Column :header="t('common.actions')" class="w-28">
          <template #body="{ data }">
            <Button icon="pi pi-eye" text rounded size="small" @click="show(data)" />
            <Button icon="pi pi-pencil" text rounded size="small" @click="openEdit(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="dialog" modal :header="editing ? t('common.edit') : t('admin.addDriver')" class="w-full max-w-lg">
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="sm:col-span-2"><label class="field-label">{{ t('common.fullName') }}</label><InputText v-model="form.fullName" class="w-full" /></div>
        <div><label class="field-label">{{ t('common.phone') }}</label><InputText v-model="form.phone" class="w-full" :disabled="!!editing" /></div>
        <div><label class="field-label">{{ t('common.password') }}</label><Password v-model="form.password" toggle-mask :feedback="false" class="w-full" input-class="w-full" /></div>
        <div><label class="field-label">{{ t('admin.license') }}</label><InputText v-model="form.licenseNumber" class="w-full uppercase" /></div>
        <div><label class="field-label">{{ t('admin.licenseCategory') }}</label><InputText v-model="form.licenseCategory" class="w-full" /></div>
        <div><label class="field-label">{{ t('admin.experience') }}</label><InputNumber v-model="form.experienceYears" :min="0" :max="60" class="w-full" /></div>
        <div v-if="editing"><label class="field-label">{{ t('common.status') }}</label><Select v-model="form.status" :options="statusOptions" option-label="label" option-value="value" class="w-full" /></div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="dialog = false" />
        <Button :label="t('common.save')" icon="pi pi-check" @click="save" />
      </template>
    </Dialog>

    <Dialog :visible="!!details" modal :header="details?.fullName" class="w-full max-w-2xl" @update:visible="details = null">
      <div v-if="details" class="space-y-3">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="muted">{{ t('common.phone') }}:</span> {{ phone(details.phone) }}</div>
          <div><span class="muted">{{ t('admin.license') }}:</span> {{ details.licenseNumber }}</div>
        </div>
        <DataTable :value="details.trips" size="small">
          <Column :header="t('admin.departureAt')"><template #body="{ data }">{{ dt(data.departureAt) }}</template></Column>
          <Column :header="t('admin.route')"><template #body="{ data }">{{ data.route?.name }}</template></Column>
          <Column :header="t('admin.bus')"><template #body="{ data }">{{ data.bus?.plateNumber }}</template></Column>
          <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.status" /></template></Column>
        </DataTable>
      </div>
    </Dialog>
  </div>
</template>
