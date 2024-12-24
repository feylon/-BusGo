<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { computed, onMounted, reactive, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api';
import { usePaged } from '@/composables/usePaged';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t, phone } = useFormat();
const { success, error, ask } = useNotify();
const { items, total, rows, loading, query, load, onPage } = usePaged(api.responsibles.list, { search: '', entityType: null });
const types = ['TRIP', 'ROUTE', 'BUS', 'REGION'];
const typeOptions = computed(() => types.map((v) => ({ label: t(`admin.entity.${v}`), value: v })));
const filterTypes = computed(() => [{ label: t('common.all'), value: null }, ...typeOptions.value]);
const entities = reactive<Record<string, { label: string; value: string }[]>>({ TRIP: [], ROUTE: [], BUS: [], REGION: [] });

const dialog = ref(false);
const editing = ref<any>(null);
const form = reactive({ name: '', phone: '+998', role: '', region: '', entityType: 'REGION', entityId: null as string | null, status: 'ACTIVE' });

function openCreate() {
  editing.value = null;
  Object.assign(form, { name: '', phone: '+998', role: '', region: '', entityType: 'REGION', entityId: null, status: 'ACTIVE' });
  dialog.value = true;
}

function openEdit(r: any) {
  editing.value = r;
  Object.assign(form, { name: r.name, phone: `+${r.phone}`, role: r.role, region: r.region ?? '', entityType: r.entityType, entityId: r.entityId, status: r.status });
  dialog.value = true;
}

const entityLabel = (r: any) => entities[r.entityType]?.find((e) => e.value === r.entityId)?.label ?? '—';

async function save() {
  try {
    const body = { ...form, region: form.region || undefined, entityId: form.entityId || undefined };
    if (editing.value) await api.responsibles.update(editing.value.id, body);
    else await api.responsibles.create(body);
    dialog.value = false;
    success(t('common.saved'));
    load();
  } catch (e) {
    error(e);
  }
}

function remove(r: any) {
  ask(t('common.confirmDelete'), async () => {
    await api.responsibles.remove(r.id).catch(error);
    load();
  });
}

onMounted(async () => {
  load();
  const [routes, buses, trips] = await Promise.all([
    api.routes.list({ limit: 100 }),
    api.buses.list({ limit: 100 }),
    api.trips.list({ limit: 100, status: 'SCHEDULED' }),
  ]);
  entities.ROUTE = routes.items.map((r: any) => ({ label: r.name, value: r.id }));
  entities.BUS = buses.items.map((b: any) => ({ label: `${b.name} · ${b.plateNumber}`, value: b.id }));
  entities.TRIP = trips.items.map((x: any) => ({ label: `${x.route?.name} · ${new Date(x.departureAt).toLocaleString('ru-RU')}`, value: x.id }));
});
</script>

<template>
  <div>
    <PageHeader :title="t('nav.responsibles')">
      <Button :label="t('admin.addResponsible')" icon="pi pi-plus" @click="openCreate" />
    </PageHeader>
    <div class="card p-4">
      <div class="mb-4 flex flex-wrap gap-3">
        <InputText v-model="query.search" :placeholder="t('common.search')" class="w-64" />
        <Select v-model="query.entityType" :options="filterTypes" option-label="label" option-value="value" class="w-44" />
      </div>
      <DataTable :value="items" :loading="loading" lazy paginator :rows="rows" :total-records="total" data-key="id" @page="onPage">
        <Column field="name" :header="t('common.fullName')" />
        <Column :header="t('common.phone')"><template #body="{ data }">{{ phone(data.phone) }}</template></Column>
        <Column field="role" :header="t('admin.position')" />
        <Column field="region" :header="t('common.region')" />
        <Column :header="t('admin.entityType')"><template #body="{ data }">{{ t(`admin.entity.${data.entityType}`) }} <span class="muted text-xs">{{ entityLabel(data) }}</span></template></Column>
        <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.status" /></template></Column>
        <Column :header="t('common.actions')" class="w-28">
          <template #body="{ data }">
            <Button icon="pi pi-pencil" text rounded size="small" @click="openEdit(data)" />
            <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="remove(data)" />
          </template>
        </Column>
      </DataTable>
    </div>
    <Dialog v-model:visible="dialog" modal :header="editing ? t('common.edit') : t('admin.addResponsible')" class="w-full max-w-lg">
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="sm:col-span-2"><label class="field-label">{{ t('common.fullName') }}</label><InputText v-model="form.name" class="w-full" /></div>
        <div><label class="field-label">{{ t('common.phone') }}</label><InputText v-model="form.phone" class="w-full" /></div>
        <div><label class="field-label">{{ t('admin.position') }}</label><InputText v-model="form.role" class="w-full" /></div>
        <div><label class="field-label">{{ t('common.region') }}</label><InputText v-model="form.region" class="w-full" /></div>
        <div><label class="field-label">{{ t('common.status') }}</label><Select v-model="form.status" :options="[{ label: t('status.ACTIVE'), value: 'ACTIVE' }, { label: t('status.INACTIVE'), value: 'INACTIVE' }]" option-label="label" option-value="value" class="w-full" /></div>
        <div><label class="field-label">{{ t('admin.entityType') }}</label><Select v-model="form.entityType" :options="typeOptions" option-label="label" option-value="value" class="w-full" @change="form.entityId = null" /></div>
        <div v-if="form.entityType !== 'REGION'"><label class="field-label">&nbsp;</label><Select v-model="form.entityId" :options="entities[form.entityType]" option-label="label" option-value="value" filter class="w-full" /></div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="dialog = false" />
        <Button :label="t('common.save')" icon="pi pi-check" @click="save" />
      </template>
    </Dialog>
  </div>
</template>
