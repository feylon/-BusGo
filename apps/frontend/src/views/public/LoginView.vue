<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import InputOtp from 'primevue/inputotp';
import Message from 'primevue/message';
import SelectButton from 'primevue/selectbutton';
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useNotify } from '@/composables/useNotify';

const { t } = useI18n();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const { error } = useNotify();

const mode = ref<'password' | 'otp'>('password');
const modes = computed(() => [
  { label: t('auth.byPassword'), value: 'password' },
  { label: t('auth.byOtp'), value: 'otp' },
]);
const login = ref('');
const password = ref('');
const phone = ref('+998');
const code = ref('');
const fullName = ref('');
const sent = ref<any>(null);
const countdown = ref(0);
const loading = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;

const demo = [
  { role: 'SUPER_ADMIN', login: '+998900000001', password: 'Admin123!' },
  { role: 'ADMIN', login: '+998900000002', password: 'Admin123!' },
  { role: 'DISPATCHER', login: '+998900000003', password: 'Dispatch123!' },
  { role: 'DRIVER', login: '+998900000011', password: 'Driver123!' },
  { role: 'PASSENGER', login: '+998900000021', password: 'Passenger123!' },
];

function done() {
  const redirect = route.query.redirect as string | undefined;
  router.replace(redirect && redirect.startsWith('/') ? redirect : auth.homeRoute);
}

async function submitPassword() {
  loading.value = true;
  try {
    await auth.login(login.value, password.value);
    done();
  } catch (e) {
    error(e);
  } finally {
    loading.value = false;
  }
}

async function sendCode() {
  loading.value = true;
  try {
    sent.value = await api.auth.sendOtp(phone.value);
    countdown.value = sent.value.resendIn;
    clearInterval(timer);
    timer = setInterval(() => {
      countdown.value = Math.max(0, countdown.value - 1);
      if (!countdown.value) clearInterval(timer);
    }, 1000);
  } catch (e) {
    error(e);
  } finally {
    loading.value = false;
  }
}

async function verify() {
  loading.value = true;
  try {
    await auth.loginWithOtp(phone.value, code.value, fullName.value || undefined);
    done();
  } catch (e) {
    error(e);
  } finally {
    loading.value = false;
  }
}

function fillDemo(d: (typeof demo)[number]) {
  mode.value = 'password';
  login.value = d.login;
  password.value = d.password;
}

onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <div class="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2 md:py-16">
    <div class="card p-6 md:p-8">
      <h1 class="text-2xl font-semibold">{{ t('auth.welcome') }}</h1>
      <p class="muted mt-1 text-sm">{{ t('auth.subtitle') }}</p>
      <Message v-if="route.query.expired" severity="warn" class="mt-4">{{ t('auth.sessionExpired') }}</Message>
      <SelectButton v-model="mode" :options="modes" option-label="label" option-value="value" :allow-empty="false" class="mt-6 w-full" />

      <form v-if="mode === 'password'" class="mt-6 space-y-4" @submit.prevent="submitPassword">
        <div>
          <label class="field-label">{{ t('auth.loginField') }}</label>
          <InputText v-model="login" class="w-full" autocomplete="username" placeholder="+998 90 123 45 67" />
        </div>
        <div>
          <label class="field-label">{{ t('common.password') }}</label>
          <Password v-model="password" :feedback="false" toggle-mask class="w-full" input-class="w-full" autocomplete="current-password" />
        </div>
        <Button type="submit" :label="t('common.login')" class="w-full" :loading="loading" />
      </form>

      <div v-else class="mt-6 space-y-4">
        <div>
          <label class="field-label">{{ t('common.phone') }}</label>
          <div class="flex gap-2">
            <InputText v-model="phone" class="flex-1" placeholder="+998 90 123 45 67" />
            <Button :label="sent && countdown ? t('auth.resendIn', { n: countdown }) : sent ? t('auth.resend') : t('auth.sendCode')" :disabled="countdown > 0" :loading="loading && !sent" outlined @click="sendCode" />
          </div>
        </div>
        <template v-if="sent">
          <Message severity="success" size="small">{{ t('auth.codeSent', { phone: `+${sent.phone}` }) }}</Message>
          <Message v-if="sent.devCode" severity="info" size="small">{{ t('auth.devCode', { code: sent.devCode }) }}</Message>
          <div>
            <label class="field-label">{{ t('auth.code') }}</label>
            <InputOtp v-model="code" :length="6" integer-only />
          </div>
          <div>
            <label class="field-label">{{ t('common.fullName') }} <span class="text-xs">({{ t('common.optional') }})</span></label>
            <InputText v-model="fullName" class="w-full" />
          </div>
          <Button :label="t('auth.verify')" class="w-full" :disabled="code.length !== 6" :loading="loading" @click="verify" />
        </template>
      </div>

      <p class="muted mt-6 text-center text-sm">
        {{ t('auth.noAccount') }}
        <RouterLink to="/register" class="font-medium text-teal-700 hover:underline">{{ t('common.register') }}</RouterLink>
      </p>
    </div>

    <div class="card p-6 md:p-8">
      <h2 class="font-semibold">{{ t('auth.demo') }}</h2>
      <div class="mt-4 space-y-2">
        <button
          v-for="d in demo"
          :key="d.role"
          type="button"
          class="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition hover:border-teal-500"
          style="border-color: var(--app-border)"
          @click="fillDemo(d)"
        >
          <span>
            <span class="font-medium">{{ t(`roles.${d.role}`) }}</span>
            <span class="muted block text-xs">{{ d.login }} · {{ d.password }}</span>
          </span>
          <i class="pi pi-arrow-right muted" />
        </button>
      </div>
    </div>
  </div>
</template>
