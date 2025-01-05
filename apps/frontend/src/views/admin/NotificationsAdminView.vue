<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import MultiSelect from 'primevue/multiselect';
import Tag from 'primevue/tag';
import { computed, onMounted, reactive, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import { api } from '@/api';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t, dt, localized } = useFormat();
const { success, error } = useNotify();
const data = ref<any>({ items: [], total: 0, stats: [] });
const page = ref(1);
const loading = ref(false);
const form = reactive({ title: '', body: '', roles: ['PASSENGER'] as string[], channels: ['IN_APP', 'PUSH'] as string[] });
const roleOptions = computed(() => ['ADMIN', 'DISPATCHER', 'DRIVER', 'PASSENGER'].map((r) => ({ label: t(`roles.${r}`), value: r })));
const channelOptions = computed(() => ['IN_APP', 'PUSH', 'SMS'].map((c) => ({ label: t(`notifications.channel.${c}`), value: c })));

async function load() {
  loading.value = true;
  try {
    data.value = await api.notifications.all({ page: page.value, limit: 20 });
  } finally {
    loading.value = false;
  }
}

async function send() {
  try {
    const res: any = await api.notifications.broadcast(form);
    success(t('notifications.sent', { n: res.recipients }));
    form.title = '';
    form.body = '';
    setTimeout(load, 1500);
  } catch (e) {
    error(e);
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader :title="t('nav.notifications')" />
    <div class="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div class="card p-4">
        <div class="mb-4 flex flex-wrap gap-2">
          <Tag v-for="s in data.stats" :key="s.type" severity="secondary" :value="`${s.type}: ${s.count}`" />
        </div>
        <DataTable :value="data.items" :loading="loading" lazy paginator :rows="20" :total-records="data.total" size="small" @page="(e) => { page = e.page + 1; load(); }">
          <Column :header="t('common.createdAt')"><template #body="{ data: n }"><span class="text-xs">{{ dt(n.createdAt) }}</span></template></Column>
          <Column field="type" :header="t('common.type')"><template #body="{ data: n }"><span class="font-mono text-xs">{{ n.type }}</span></template></Column>
          <Column :header="t('notifications.broadcastTitle')"><template #body="{ data: n }"><div class="font-medium">{{ localized(n.title) }}</div><div class="muted line-clamp-1 text-xs">{{ localized(n.body) }}</div></template></Column>
          <Column :header="t('notifications.channels')"><template #body="{ data: n }"><span class="text-xs">{{ n.channels.join(', ') }}</span></template></Column>
          <Column :header="t('common.status')"><template #body="{ data: n }"><i :class="n.readAt ? 'pi pi-check-circle text-emerald-600' : 'pi pi-circle muted'" /></template></Column>
        </DataTable>
      </div>
      <div class="card h-fit space-y-3 p-5">
        <h3 class="font-semibold"><i class="pi pi-megaphone mr-2 text-teal-600" />{{ t('notifications.broadcast') }}</h3>
        <div><label class="field-label">{{ t('notifications.broadcastTitle') }}</label><InputText v-model="form.title" class="w-full" /></div>
        <div><label class="field-label">{{ t('notifications.broadcastBody') }}</label><Textarea v-model="form.body" rows="4" class="w-full" /></div>
        <div><label class="field-label">{{ t('notifications.audience') }}</label><MultiSelect v-model="form.roles" :options="roleOptions" option-label="label" option-value="value" class="w-full" display="chip" /></div>
        <div><label class="field-label">{{ t('notifications.channels') }}</label><MultiSelect v-model="form.channels" :options="channelOptions" option-label="label" option-value="value" class="w-full" display="chip" /></div>
        <Button class="w-full" icon="pi pi-send" :label="t('notifications.broadcast')" :disabled="form.title.length < 2 || form.body.length < 2" @click="send" />
      </div>
    </div>
  </div>
</template>
