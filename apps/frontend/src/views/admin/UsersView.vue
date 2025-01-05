<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Select from 'primevue/select';
import MultiSelect from 'primevue/multiselect';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import Tag from 'primevue/tag';
import { computed, onMounted, reactive, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api';
import { usePaged } from '@/composables/usePaged';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';
import { useAuthStore } from '@/stores/auth';

const { t, dt, phone } = useFormat();
const { success, error, ask } = useNotify();
const auth = useAuthStore();
const { items, total, rows, loading, query, load, onPage } = usePaged(api.users.list, { search: '', role: null, status: null });

const roleNames = ['SUPER_ADMIN', 'ADMIN', 'DISPATCHER', 'DRIVER', 'PASSENGER'];
const roleOptions = computed(() => roleNames.map((r) => ({ label: t(`roles.${r}`), value: r })).filter((r) => auth.hasRole('SUPER_ADMIN') || !['SUPER_ADMIN', 'ADMIN'].includes(r.value)));
const filterRoles = computed(() => [{ label: t('common.all'), value: null }, ...roleNames.map((r) => ({ label: t(`roles.${r}`), value: r }))]);
const statuses = computed(() => [{ label: t('common.all'), value: null }, { label: t('status.ACTIVE'), value: 'ACTIVE' }, { label: t('status.BLOCKED'), value: 'BLOCKED' }]);

const dialog = ref(false);
const editing = ref<any>(null);
const form = reactive({ fullName: '', phone: '+998', email: '', password: '', roles: ['DISPATCHER'] as string[], status: 'ACTIVE' });

function openCreate() {
  editing.value = null;
  Object.assign(form, { fullName: '', phone: '+998', email: '', password: '', roles: ['DISPATCHER'], status: 'ACTIVE' });
  dialog.value = true;
}

function openEdit(u: any) {
  editing.value = u;
  Object.assign(form, { fullName: u.fullName, phone: `+${u.phone}`, email: u.email ?? '', password: '', roles: [...u.roles], status: u.status });
  dialog.value = true;
}

async function save() {
  try {
    if (editing.value) {
      await api.users.update(editing.value.id, { fullName: form.fullName, email: form.email || undefined, roles: form.roles, status: form.status, ...(form.password ? { password: form.password } : {}) });
    } else {
      await api.users.create({ fullName: form.fullName, phone: form.phone, email: form.email || undefined, password: form.password, roles: form.roles });
    }
    dialog.value = false;
    success(t('common.saved'));
    load();
  } catch (e) {
    error(e);
  }
}

function remove(u: any) {
  ask(t('common.confirmDelete'), async () => {
    try {
      await api.users.remove(u.id);
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
    <PageHeader :title="t('nav.users')">
      <Button v-if="auth.can('users.create')" :label="t('admin.addUser')" icon="pi pi-plus" @click="openCreate" />
    </PageHeader>
    <div class="card p-4">
      <div class="mb-4 flex flex-wrap gap-3">
        <IconField class="w-full md:w-72">
          <InputIcon class="pi pi-search" />
          <InputText v-model="query.search" :placeholder="t('common.search')" class="w-full" />
        </IconField>
        <Select v-model="query.role" :options="filterRoles" option-label="label" option-value="value" class="w-48" />
        <Select v-model="query.status" :options="statuses" option-label="label" option-value="value" class="w-40" />
      </div>
      <DataTable :value="items" :loading="loading" lazy paginator :rows="rows" :total-records="total" :rows-per-page-options="[20, 50, 100]" data-key="id" @page="onPage">
        <Column field="fullName" :header="t('common.fullName')" />
        <Column :header="t('common.phone')"><template #body="{ data }">{{ phone(data.phone) }}</template></Column>
        <Column field="email" :header="t('common.email')" />
        <Column :header="t('admin.roles')">
          <template #body="{ data }"><Tag v-for="r in data.roles" :key="r" :value="t(`roles.${r}`)" severity="secondary" class="mr-1 !text-xs" /></template>
        </Column>
        <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.status" /></template></Column>
        <Column :header="t('admin.lastLogin')"><template #body="{ data }">{{ dt(data.lastLoginAt) }}</template></Column>
        <Column :header="t('common.actions')" class="w-28">
          <template #body="{ data }">
            <Button v-if="auth.can('users.update')" icon="pi pi-pencil" text rounded size="small" @click="openEdit(data)" />
            <Button v-if="auth.can('users.delete') && data.id !== auth.user?.id" icon="pi pi-trash" text rounded size="small" severity="danger" @click="remove(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="dialog" modal :header="editing ? t('common.edit') : t('admin.addUser')" class="w-full max-w-lg">
      <div class="space-y-3">
        <div><label class="field-label">{{ t('common.fullName') }}</label><InputText v-model="form.fullName" class="w-full" /></div>
        <div><label class="field-label">{{ t('common.phone') }}</label><InputText v-model="form.phone" class="w-full" :disabled="!!editing" /></div>
        <div><label class="field-label">{{ t('common.email') }}</label><InputText v-model="form.email" class="w-full" /></div>
        <div><label class="field-label">{{ t('common.password') }}</label><Password v-model="form.password" toggle-mask :feedback="false" class="w-full" input-class="w-full" /></div>
        <div><label class="field-label">{{ t('admin.roles') }}</label><MultiSelect v-model="form.roles" :options="roleOptions" option-label="label" option-value="value" class="w-full" /></div>
        <div v-if="editing"><label class="field-label">{{ t('common.status') }}</label><Select v-model="form.status" :options="statuses.slice(1)" option-label="label" option-value="value" class="w-full" /></div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="dialog = false" />
        <Button :label="t('common.save')" icon="pi pi-check" @click="save" />
      </template>
    </Dialog>
  </div>
</template>
