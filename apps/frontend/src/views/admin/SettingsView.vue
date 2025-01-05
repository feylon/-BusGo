<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Checkbox from 'primevue/checkbox';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { onMounted, reactive, ref } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const { t, dt } = useFormat();
const { success, error } = useNotify();
const auth = useAuthStore();
const s = reactive<Record<string, any>>({});
const health = ref<any>(null);
const roles = ref<any[]>([]);
const permissions = ref<any[]>([]);
const matrix = reactive<Record<string, string[]>>({});

const numberFields = [
  ['booking.paymentTimeoutMin', 'settings.paymentTimeout'],
  ['booking.seatLockTtlSec', 'settings.seatLockTtl'],
  ['booking.maxSeatsPerBooking', 'settings.maxSeats'],
  ['booking.cancelBeforeDepartureMin', 'settings.cancelBefore'],
  ['booking.salesCloseBeforeDepartureMin', 'settings.salesClose'],
  ['trip.reminderBeforeMin', 'settings.reminderBefore'],
  ['trip.boardingBeforeMin', 'settings.boardingBefore'],
  ['trip.delayThresholdMin', 'settings.delayThreshold'],
];

async function load() {
  Object.assign(s, await api.settings.all());
  health.value = await api.health.services().catch(() => null);
  if (auth.hasRole('SUPER_ADMIN')) {
    [roles.value, permissions.value] = await Promise.all([api.users.roles(), api.users.permissions()]);
    for (const r of roles.value) matrix[r.id] = r.permissions.map((p: any) => p.code);
  }
}

async function save() {
  try {
    Object.assign(s, await api.settings.update({ ...s }));
    success(t('common.saved'));
  } catch (e) {
    error(e);
  }
}

async function saveRole(r: any) {
  try {
    await api.users.setRolePermissions(r.id, matrix[r.id]);
    success(t('common.saved'));
  } catch (e) {
    error(e);
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader :title="t('nav.settings')">
      <Button :label="t('common.save')" icon="pi pi-check" @click="save" />
    </PageHeader>
    <div class="grid gap-6 xl:grid-cols-2">
      <div class="card space-y-4 p-5">
        <h3 class="font-semibold">{{ t('settings.booking') }} / {{ t('settings.trip') }}</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <div v-for="[key, label] in numberFields" :key="key">
            <label class="field-label">{{ t(label) }}</label>
            <InputNumber v-model="s[key]" :min="0" class="w-full" />
          </div>
        </div>
        <h3 class="pt-2 font-semibold">{{ t('settings.multipliers') }}</h3>
        <div v-if="s['pricing.seatMultipliers']" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div v-for="type in ['STANDARD', 'COMFORT', 'VIP', 'ACCESSIBLE']" :key="type">
            <label class="field-label">{{ t(`seatType.${type}`) }}</label>
            <InputNumber v-model="s['pricing.seatMultipliers'][type]" :min="0.1" :max="5" :step="0.1" :min-fraction-digits="1" class="w-full" />
          </div>
        </div>
        <h3 class="pt-2 font-semibold">{{ t('settings.company') }}</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <div><label class="field-label">{{ t('settings.companyName') }}</label><InputText v-model="s['company.name']" class="w-full" /></div>
          <div><label class="field-label">{{ t('settings.companyPhone') }}</label><InputText v-model="s['company.phone']" class="w-full" /></div>
        </div>
      </div>

      <div class="space-y-6">
        <div v-if="health" class="card p-5">
          <h3 class="mb-3 font-semibold">{{ t('dashboard.services') }}</h3>
          <div class="grid gap-2 sm:grid-cols-2">
            <div v-for="sv in health.services" :key="sv.name" class="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style="border-color: var(--app-border)">
              <span class="font-mono text-xs">{{ sv.name }}</span>
              <StatusBadge :status="sv.status === 'ok' ? 'ONLINE' : 'OFFLINE'" />
            </div>
          </div>
        </div>
        <div v-if="health?.jobs?.length" class="card p-4">
          <h3 class="mb-3 font-semibold">{{ t('settings.jobs') }}</h3>
          <DataTable :value="health.jobs" size="small">
            <Column field="name" header="Job"><template #body="{ data }"><span class="font-mono text-xs">{{ data.name }}</span></template></Column>
            <Column field="schedule" :header="t('settings.schedule')" />
            <Column :header="t('settings.lastRun')"><template #body="{ data }"><span class="text-xs">{{ dt(data.lastRun?.lastRunAt, { second: '2-digit' }) }}</span></template></Column>
            <Column :header="t('common.status')"><template #body="{ data }"><StatusBadge :status="data.lastRun ? (data.lastRun.status === 'ok' ? 'SUCCEEDED' : 'FAILED') : 'PENDING'" /></template></Column>
            <Column header="✓ / ✗"><template #body="{ data }"><span class="text-xs">{{ data.ok }} / {{ data.failed }}</span></template></Column>
          </DataTable>
        </div>
      </div>
    </div>

    <div v-if="roles.length" class="card mt-6 overflow-x-auto p-4">
      <h3 class="mb-3 font-semibold">{{ t('settings.permissions') }}</h3>
      <table class="w-full text-sm">
        <thead>
          <tr>
            <th class="py-2 text-left">Permission</th>
            <th v-for="r in roles" :key="r.id" class="px-2 py-2 text-center">{{ t(`roles.${r.name}`) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in permissions" :key="p.id" class="border-t" style="border-color: var(--app-border)">
            <td class="py-1.5 font-mono text-xs">{{ p.code }}</td>
            <td v-for="r in roles" :key="r.id" class="text-center">
              <Checkbox v-model="matrix[r.id]" :value="p.code" :disabled="r.name === 'SUPER_ADMIN'" />
            </td>
          </tr>
          <tr>
            <td />
            <td v-for="r in roles" :key="r.id" class="pt-3 text-center">
              <Button v-if="r.name !== 'SUPER_ADMIN'" size="small" outlined :label="t('common.save')" @click="saveRole(r)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
