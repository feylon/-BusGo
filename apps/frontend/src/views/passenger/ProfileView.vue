<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Select from 'primevue/select';
import Checkbox from 'primevue/checkbox';
import { onMounted, reactive, ref } from 'vue';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { useFormat } from '@/composables/useFormat';
import { useNotify } from '@/composables/useNotify';

const auth = useAuthStore();
const ui = useUiStore();
const { t, phone } = useFormat();
const { success, error } = useNotify();
const form = reactive({ fullName: auth.user?.fullName ?? '', email: auth.user?.email ?? '', lang: auth.user?.lang ?? 'uz' });
const pass = reactive({ currentPassword: '', newPassword: '' });
const prefs = ref<{ channels: string[] }>({ channels: ['IN_APP', 'PUSH'] });
const passengers = ref<any[]>([]);
const langs = [
  { label: "O'zbekcha", value: 'uz' },
  { label: 'Русский', value: 'ru' },
  { label: 'English', value: 'en' },
];

onMounted(async () => {
  prefs.value = await api.notifications.preferences().catch(() => prefs.value);
  passengers.value = await api.passengers.mine().catch(() => []);
});

async function save() {
  try {
    const u = await api.auth.update({ ...form, email: form.email || undefined });
    auth.setUser(u);
    ui.lang = form.lang as any;
    await api.notifications.savePreferences({ channels: prefs.value.channels });
    success(t('common.saved'));
  } catch (e) {
    error(e);
  }
}

async function changePassword() {
  try {
    await api.auth.password(pass);
    pass.currentPassword = '';
    pass.newPassword = '';
    success(t('common.saved'));
  } catch (e) {
    error(e);
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8">
    <h1 class="page-title mb-6">{{ t('profile.title') }}</h1>
    <div class="grid gap-6 md:grid-cols-2">
      <div class="card space-y-4 p-5">
        <h2 class="font-semibold">{{ t('profile.personal') }}</h2>
        <div>
          <label class="field-label">{{ t('common.fullName') }}</label>
          <InputText v-model="form.fullName" class="w-full" />
        </div>
        <div>
          <label class="field-label">{{ t('common.phone') }}</label>
          <InputText :model-value="phone(auth.user?.phone)" disabled class="w-full" />
        </div>
        <div>
          <label class="field-label">{{ t('common.email') }}</label>
          <InputText v-model="form.email" class="w-full" />
        </div>
        <div>
          <label class="field-label">{{ t('common.language') }}</label>
          <Select v-model="form.lang" :options="langs" option-label="label" option-value="value" class="w-full" />
        </div>
        <div>
          <label class="field-label">{{ t('notifications.channels') }}</label>
          <div class="flex flex-wrap gap-4">
            <label v-for="c in ['IN_APP', 'PUSH', 'SMS']" :key="c" class="flex items-center gap-2 text-sm">
              <Checkbox v-model="prefs.channels" :value="c" :disabled="c === 'IN_APP'" />
              {{ t(`notifications.channel.${c}`) }}
            </label>
          </div>
        </div>
        <Button :label="t('common.save')" icon="pi pi-check" @click="save" />
      </div>
      <div class="space-y-6">
        <div class="card space-y-4 p-5">
          <h2 class="font-semibold">{{ t('auth.changePassword') }}</h2>
          <div>
            <label class="field-label">{{ t('auth.currentPassword') }}</label>
            <Password v-model="pass.currentPassword" :feedback="false" toggle-mask class="w-full" input-class="w-full" />
          </div>
          <div>
            <label class="field-label">{{ t('auth.newPassword') }}</label>
            <Password v-model="pass.newPassword" toggle-mask class="w-full" input-class="w-full" />
          </div>
          <Button :label="t('common.save')" outlined :disabled="pass.newPassword.length < 6" @click="changePassword" />
        </div>
        <div v-if="passengers.length" class="card p-5">
          <h2 class="mb-3 font-semibold">{{ t('profile.savedPassengers') }}</h2>
          <div v-for="p in passengers" :key="p.id" class="flex justify-between border-b py-2 text-sm last:border-0" style="border-color: var(--app-border)">
            <span>{{ p.fullName }}</span>
            <span class="muted">{{ phone(p.phone) }} {{ p.documentNumber ? `· ${p.documentNumber}` : '' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
