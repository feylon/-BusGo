<script setup lang="ts">
import Button from 'primevue/button';
import Drawer from 'primevue/drawer';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import NotificationBell from '@/components/NotificationBell.vue';
import UserMenu from '@/components/UserMenu.vue';

const auth = useAuthStore();
const ui = useUiStore();
const { t } = useI18n();
const mobile = ref(false);
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-30 border-b backdrop-blur" style="border-color: var(--app-border); background: color-mix(in srgb, var(--app-surface) 88%, transparent)">
      <div class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <RouterLink to="/" class="flex items-center gap-2">
          <img src="/favicon.svg" alt="" class="h-9 w-9" />
          <div class="leading-tight">
            <div class="text-lg font-bold tracking-tight">BusLine</div>
            <div class="muted hidden text-[11px] sm:block">{{ t('app.tagline') }}</div>
          </div>
        </RouterLink>
        <nav class="ml-6 hidden items-center gap-1 md:flex">
          <RouterLink to="/" class="rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800" exact-active-class="text-teal-700">{{ t('nav.home') }}</RouterLink>
          <RouterLink to="/routes" class="rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800" active-class="text-teal-700">{{ t('nav.routes') }}</RouterLink>
          <template v-if="auth.isAuthenticated && auth.hasRole('PASSENGER')">
            <RouterLink to="/my-bookings" class="rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800" active-class="text-teal-700">{{ t('nav.myBookings') }}</RouterLink>
            <RouterLink to="/my-tickets" class="rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800" active-class="text-teal-700">{{ t('nav.myTickets') }}</RouterLink>
          </template>
          <RouterLink v-if="auth.isAuthenticated && !auth.hasRole('PASSENGER')" :to="auth.homeRoute" class="rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">{{ t('nav.dashboard') }}</RouterLink>
        </nav>
        <div class="ml-auto flex items-center gap-2">
          <LanguageSwitcher class="hidden sm:inline-flex" />
          <Button text rounded severity="secondary" :icon="ui.dark ? 'pi pi-sun' : 'pi pi-moon'" :aria-label="t('common.darkMode')" @click="ui.dark = !ui.dark" />
          <template v-if="auth.isAuthenticated">
            <NotificationBell />
            <UserMenu />
          </template>
          <template v-else>
            <RouterLink to="/login" class="hidden sm:block"><Button :label="t('common.login')" text /></RouterLink>
            <RouterLink to="/register"><Button :label="t('common.register')" size="small" /></RouterLink>
          </template>
          <Button class="md:!hidden" text rounded severity="secondary" icon="pi pi-bars" @click="mobile = true" />
        </div>
      </div>
    </header>

    <Drawer v-model:visible="mobile" position="right" :header="'BusLine'">
      <div class="flex flex-col gap-1">
        <RouterLink to="/" class="rounded-lg px-3 py-2 hover:bg-slate-100" @click="mobile = false">{{ t('nav.home') }}</RouterLink>
        <RouterLink to="/routes" class="rounded-lg px-3 py-2 hover:bg-slate-100" @click="mobile = false">{{ t('nav.routes') }}</RouterLink>
        <template v-if="auth.isAuthenticated">
          <RouterLink :to="auth.homeRoute" class="rounded-lg px-3 py-2 hover:bg-slate-100" @click="mobile = false">{{ t('nav.dashboard') }}</RouterLink>
          <RouterLink to="/my-bookings" class="rounded-lg px-3 py-2 hover:bg-slate-100" @click="mobile = false">{{ t('nav.myBookings') }}</RouterLink>
          <RouterLink to="/my-tickets" class="rounded-lg px-3 py-2 hover:bg-slate-100" @click="mobile = false">{{ t('nav.myTickets') }}</RouterLink>
        </template>
        <RouterLink v-else to="/login" class="rounded-lg px-3 py-2 hover:bg-slate-100" @click="mobile = false">{{ t('common.login') }}</RouterLink>
        <LanguageSwitcher class="mt-4 self-start" />
      </div>
    </Drawer>

    <main class="flex-1">
      <RouterView />
    </main>

    <footer class="mt-12 border-t py-8" style="border-color: var(--app-border)">
      <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-sm md:flex-row">
        <div class="muted">© {{ new Date().getFullYear() }} BusLine · {{ t('app.tagline') }}</div>
        <div class="muted flex items-center gap-4">
          <span><i class="pi pi-phone mr-1" />+998 71 200 00 00</span>
          <a href="/api/docs" target="_blank" class="hover:text-teal-700">API</a>
        </div>
      </div>
    </footer>
  </div>
</template>
