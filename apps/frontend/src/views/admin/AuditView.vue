<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import { computed, onMounted, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import { api } from '@/api';
import { usePaged } from '@/composables/usePaged';
import { downloadCsv, useFormat } from '@/composables/useFormat';

const { t, dt } = useFormat();
const { items, total, rows, loading, query, load, onPage } = usePaged(api.audit.list, { search: '', action: null, entity: null, role: null, userId: '', ip: '', from: '', to: '' }, 25);
const meta = ref<{ actions: { action: string; count: number }[]; entities: string[] }>({ actions: [], entities: [] });
const selected = ref<any>(null);
const actionOptions = computed(() => [{ label: t('common.all'), value: null }, ...meta.value.actions.map((a) => ({ label: `${a.action} (${a.count})`, value: a.action }))]);
const entityOptions = computed(() => [{ label: t('common.all'), value: null }, ...meta.value.entities.map((e) => ({ label: e, value: e }))]);
const roleOptions = computed(() => [{ label: t('common.all'), value: null }, ...['SUPER_ADMIN', 'ADMIN', 'DISPATCHER', 'DRIVER', 'PASSENGER'].map((r) => ({ label: t(`roles.${r}`), value: r }))]);

const severity = (action: string) =>
  /DELETED|CANCELLED/.test(action) ? 'danger' : /CREATED|REGISTERED|SUCCEEDED/.test(action) ? 'success' : /LOGIN|LOGOUT/.test(action) ? 'info' : 'secondary';

function reset() {
  Object.assign(query, { search: '', action: null, entity: null, role: null, userId: '', ip: '', from: '', to: '' });
}

onMounted(async () => {
  load();
  meta.value = (await api.audit.actions().catch(() => meta.value)) as any;
});
</script>

<template>
  <div>
    <PageHeader :title="t('nav.audit')">
      <Button :label="t('common.exportCsv')" icon="pi pi-download" outlined @click="downloadCsv('audit', items)" />
    </PageHeader>
    <div class="card p-4">
      <div class="mb-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <IconField class="md:col-span-2">
          <InputIcon class="pi pi-search" />
          <InputText v-model="query.search" :placeholder="t('common.search')" class="w-full" />
        </IconField>
        <Select v-model="query.action" :options="actionOptions" option-label="label" option-value="value" filter :placeholder="t('audit.action')" />
        <Select v-model="query.entity" :options="entityOptions" option-label="label" option-value="value" :placeholder="t('audit.entity')" />
        <Select v-model="query.role" :options="roleOptions" option-label="label" option-value="value" :placeholder="t('audit.role')" />
        <InputText v-model="query.ip" :placeholder="t('audit.ip')" />
        <InputText v-model="query.from" type="date" />
        <div class="flex gap-2"><InputText v-model="query.to" type="date" class="flex-1" /><Button icon="pi pi-filter-slash" text @click="reset" /></div>
      </div>
      <InputText v-model="query.userId" :placeholder="`${t('audit.user')} ID`" class="mb-3 w-full font-mono text-xs md:w-96" />
      <DataTable :value="items" :loading="loading" lazy paginator :rows="rows" :total-records="total" :rows-per-page-options="[25, 50, 100]" data-key="id" size="small" row-hover @page="onPage" @row-click="(e) => (selected = e.data)">
        <Column :header="t('common.time')"><template #body="{ data }"><span class="text-xs whitespace-nowrap">{{ dt(data.createdAt, { second: '2-digit' }) }}</span></template></Column>
        <Column :header="t('audit.action')"><template #body="{ data }"><Tag :value="data.action" :severity="severity(data.action)" class="!font-mono !text-[11px]" /></template></Column>
        <Column :header="t('audit.entity')"><template #body="{ data }"><span class="text-xs">{{ data.entity }}</span> <span class="muted font-mono text-[10px]">{{ data.entityId?.slice(0, 8) }}</span></template></Column>
        <Column :header="t('audit.user')"><template #body="{ data }"><span class="font-mono text-[11px]">{{ data.userId?.slice(0, 8) ?? '—' }}</span> <span class="muted text-xs">{{ data.userRole ? t(`roles.${data.userRole}`) : '' }}</span></template></Column>
        <Column :header="t('audit.endpoint')"><template #body="{ data }"><span class="font-mono text-[11px]">{{ data.method }} {{ data.endpoint }}</span></template></Column>
        <Column field="ipAddress" :header="t('audit.ip')"><template #body="{ data }"><span class="font-mono text-xs">{{ data.ipAddress }}</span></template></Column>
      </DataTable>
    </div>
    <Dialog :visible="!!selected" modal :header="selected?.action" class="w-full max-w-2xl" @update:visible="selected = null">
      <div v-if="selected" class="space-y-2 text-sm">
        <div class="grid grid-cols-2 gap-2">
          <div><span class="muted">{{ t('common.time') }}:</span> {{ dt(selected.createdAt, { second: '2-digit', year: 'numeric' }) }}</div>
          <div><span class="muted">{{ t('audit.role') }}:</span> {{ selected.userRole }}</div>
          <div class="col-span-2"><span class="muted">{{ t('audit.user') }}:</span> <span class="font-mono text-xs">{{ selected.userId }}</span></div>
          <div class="col-span-2"><span class="muted">{{ t('audit.entity') }}:</span> {{ selected.entity }} <span class="font-mono text-xs">{{ selected.entityId }}</span></div>
          <div class="col-span-2"><span class="muted">{{ t('audit.endpoint') }}:</span> <span class="font-mono text-xs">{{ selected.method }} {{ selected.endpoint }}</span></div>
          <div><span class="muted">{{ t('audit.ip') }}:</span> {{ selected.ipAddress }}</div>
          <div class="truncate"><span class="muted">UA:</span> <span class="text-xs">{{ selected.userAgent }}</span></div>
          <div class="col-span-2"><span class="muted">Correlation:</span> <span class="font-mono text-xs">{{ selected.correlationId }}</span></div>
        </div>
        <div class="field-label mt-3">{{ t('audit.metadata') }}</div>
        <pre class="max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-200">{{ JSON.stringify(selected.metadata, null, 2) }}</pre>
      </div>
    </Dialog>
  </div>
</template>
