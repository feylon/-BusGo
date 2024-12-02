<script setup lang="ts">
import Menu from 'primevue/menu';
import Avatar from 'primevue/avatar';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();
const menu = ref();

const initials = computed(() =>
  (auth.user?.fullName ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase(),
);

const items = computed(() => [
  { label: auth.user?.fullName, items: [
    { label: t('nav.dashboard'), icon: 'pi pi-th-large', command: () => router.push(auth.homeRoute) },
    ...(auth.hasRole('PASSENGER')
      ? [
          { label: t('nav.myBookings'), icon: 'pi pi-ticket', command: () => router.push('/my-bookings') },
          { label: t('nav.myTickets'), icon: 'pi pi-qrcode', command: () => router.push('/my-tickets') },
        ]
      : []),
    { label: t('nav.profile'), icon: 'pi pi-user', command: () => router.push('/profile') },
    { separator: true },
    {
      label: t('common.logout'),
      icon: 'pi pi-sign-out',
      command: async () => {
        await auth.logout();
        router.push('/login');
      },
    },
  ] },
]);
</script>

<template>
  <button type="button" class="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800" @click="menu?.toggle($event)">
    <Avatar :label="initials" shape="circle" class="!bg-teal-700 !text-white" />
    <div class="hidden text-left leading-tight md:block">
      <div class="max-w-36 truncate text-sm font-medium">{{ auth.user?.fullName }}</div>
      <div class="muted text-xs">{{ t(`roles.${auth.roles[0] ?? 'PASSENGER'}`) }}</div>
    </div>
    <i class="pi pi-angle-down muted hidden text-xs md:block" />
  </button>
  <Menu ref="menu" :model="items" popup />
</template>
