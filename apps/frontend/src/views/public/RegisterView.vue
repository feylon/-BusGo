<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import InputOtp from 'primevue/inputotp';
import Message from 'primevue/message';
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useNotify } from '@/composables/useNotify';

const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();
const { error } = useNotify();
const form = reactive({ fullName: '', phone: '+998', email: '', password: '', code: '' });
const sent = ref<any>(null);
const loading = ref(false);

async function send() {
  loading.value = true;
  try {
    sent.value = await api.auth.sendOtp(form.phone, 'REGISTER');
  } catch (e) {
    error(e);
  } finally {
    loading.value = false;
  }
}

async function submit() {
  loading.value = true;
  try {
    await auth.register({ ...form, email: form.email || undefined });
    router.replace(auth.homeRoute);
  } catch (e) {
    error(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-10 md:py-16">
    <div class="card p-6 md:p-8">
      <h1 class="text-2xl font-semibold">{{ t('auth.registerTitle') }}</h1>
      <form class="mt-6 space-y-4" @submit.prevent="sent ? submit() : send()">
        <div>
          <label class="field-label">{{ t('common.fullName') }}</label>
          <InputText v-model="form.fullName" class="w-full" required minlength="2" />
        </div>
        <div>
          <label class="field-label">{{ t('common.phone') }}</label>
          <InputText v-model="form.phone" class="w-full" :disabled="!!sent" />
        </div>
        <div>
          <label class="field-label">{{ t('common.email') }} <span class="text-xs">({{ t('common.optional') }})</span></label>
          <InputText v-model="form.email" type="email" class="w-full" />
        </div>
        <div>
          <label class="field-label">{{ t('common.password') }}</label>
          <Password v-model="form.password" toggle-mask class="w-full" input-class="w-full" :feedback="false" />
          <small class="muted">{{ t('auth.passwordHint') }}</small>
        </div>
        <template v-if="sent">
          <Message severity="success" size="small">{{ t('auth.codeSent', { phone: `+${sent.phone}` }) }}</Message>
          <Message v-if="sent.devCode" severity="info" size="small">{{ t('auth.devCode', { code: sent.devCode }) }}</Message>
          <div>
            <label class="field-label">{{ t('auth.code') }}</label>
            <InputOtp v-model="form.code" :length="6" integer-only />
          </div>
        </template>
        <Button type="submit" :label="sent ? t('common.register') : t('auth.sendCode')" class="w-full" :loading="loading" :disabled="form.fullName.length < 2 || form.password.length < 6 || (sent && form.code.length !== 6)" />
      </form>
      <p class="muted mt-6 text-center text-sm">
        {{ t('auth.haveAccount') }}
        <RouterLink to="/login" class="font-medium text-teal-700 hover:underline">{{ t('common.login') }}</RouterLink>
      </p>
    </div>
  </div>
</template>
