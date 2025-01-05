<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import { computed, onMounted, reactive, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import TripMap from '@/components/TripMap.vue';
import { api } from '@/api';
import { usePaged } from '@/composables/usePaged';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t } = useFormat();
const { success, error, ask } = useNotify();
const { items, total, rows, loading, query, load, onPage } = usePaged(api.stops.list, { search: '' }, 50);
const dialog = ref(false);
const editing = ref<any>(null);
const form = reactive({ name: '', city: '', region: '', address: '', latitude: 41.3, longitude: 69.24 });
const allStops = computed(() => items.value.map((s: any) => ({ name: `${s.name} (${s.city})`, latitude: s.latitude, longitude: s.longitude })));

function openCreate() {
  editing.value = null;
  Object.assign(form, { name: '', city: '', region: '', address: '', latitude: 41.3, longitude: 69.24 });
  dialog.value = true;
}

function openEdit(s: any) {
  editing.value = s;
  Object.assign(form, { name: s.name, city: s.city, region: s.region ?? '', address: s.address ?? '', latitude: s.latitude, longitude: s.longitude });
  dialog.value = true;
}

function pick(lat: number, lng: number) {
  form.latitude = Math.round(lat * 1e5) / 1e5;
  form.longitude = Math.round(lng * 1e5) / 1e5;
}

async function save() {
  try {
    const body = { ...form, region: form.region || undefined, address: form.address || undefined };
    if (editing.value) await api.stops.update(editing.value.id, body);
    else await api.stops.create(body);
    dialog.value = false;
    success(t('common.saved'));
    load();
  } catch (e) {
    error(e);
  }
}

function remove(s: any) {
  ask(t('common.confirmDelete'), async () => {
    try {
      await api.stops.remove(s.id);
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
    <PageHeader :title="t('nav.stops')">
      <Button :label="t('admin.addStop')" icon="pi pi-plus" @click="openCreate" />
    </PageHeader>
    <div class="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div class="card p-4">
        <IconField class="mb-4 w-full md:w-72">
          <InputIcon class="pi pi-search" />
          <InputText v-model="query.search" :placeholder="t('common.search')" class="w-full" />
        </IconField>
        <DataTable :value="items" :loading="loading" lazy paginator :rows="rows" :total-records="total" data-key="id" size="small" @page="onPage">
          <Column field="name" :header="t('common.name')" />
          <Column field="city" :header="t('common.city')" />
          <Column field="region" :header="t('common.region')" />
          <Column :header="`${t('admin.latitude')}, ${t('admin.longitude')}`"><template #body="{ data }"><span class="font-mono text-xs">{{ data.latitude.toFixed(4) }}, {{ data.longitude.toFixed(4) }}</span></template></Column>
          <Column :header="t('common.actions')" class="w-28">
            <template #body="{ data }">
              <Button icon="pi pi-pencil" text rounded size="small" @click="openEdit(data)" />
              <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="remove(data)" />
            </template>
          </Column>
        </DataTable>
      </div>
      <div class="card overflow-hidden"><TripMap :routes="[{ tripId: 'all', stops: allStops }]" height="560px" /></div>
    </div>

    <Dialog v-model:visible="dialog" modal :header="editing ? t('common.edit') : t('admin.addStop')" class="w-full max-w-2xl">
      <div class="grid gap-3 sm:grid-cols-2">
        <div><label class="field-label">{{ t('common.name') }}</label><InputText v-model="form.name" class="w-full" /></div>
        <div><label class="field-label">{{ t('common.city') }}</label><InputText v-model="form.city" class="w-full" /></div>
        <div><label class="field-label">{{ t('common.region') }}</label><InputText v-model="form.region" class="w-full" /></div>
        <div><label class="field-label">{{ t('common.description') }}</label><InputText v-model="form.address" class="w-full" /></div>
        <div><label class="field-label">{{ t('admin.latitude') }}</label><InputNumber v-model="form.latitude" :min-fraction-digits="2" :max-fraction-digits="6" class="w-full" /></div>
        <div><label class="field-label">{{ t('admin.longitude') }}</label><InputNumber v-model="form.longitude" :min-fraction-digits="2" :max-fraction-digits="6" class="w-full" /></div>
        <div class="sm:col-span-2">
          <div class="field-label">{{ t('admin.pickOnMap') }}</div>
          <div class="overflow-hidden rounded-xl"><TripMap :vehicles="[{ tripId: 'p', latitude: form.latitude, longitude: form.longitude }]" height="260px" @pick="pick" /></div>
        </div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="dialog = false" />
        <Button :label="t('common.save')" icon="pi pi-check" @click="save" />
      </template>
    </Dialog>
  </div>
</template>
