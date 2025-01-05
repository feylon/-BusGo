<script setup lang="ts">
import Button from 'primevue/button';
import Drawer from 'primevue/drawer';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import NotificationBell from '@/components/NotificationBell.vue';
import UserMenu from '@/components/UserMenu.vue';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  perm?: string;
}

const route = useRoute();
const auth = useAuthStore();
const ui = useUiStore();
const { t } = useI18n();

const area = computed(() => route.matched[0]?.meta.area as string);

const sections = computed<{ title: string; items: NavItem[] }[]>(() => {
  if (area.value === 'driver')
    return [
      {
        title: t('nav.operations'),
        items: [
          { to: '/driver', label: t('nav.dashboard'), icon: 'pi-home' },
          { to: '/driver/trips', label: t('nav.trips'), icon: 'pi-calendar' },
          { to: '/driver/passengers', label: t('nav.passengers'), icon: 'pi-users' },
          { to: '/driver/qr', label: t('nav.qr'), icon: 'pi-qrcode' },
          { to: '/driver/tracking', label: t('nav.tracking'), icon: 'pi-map-marker' },
        ],
      },
    ];
  if (area.value === 'dispatcher')
    return [
      {
        title: t('nav.operations'),
        items: [
          { to: '/dispatcher', label: t('nav.overview'), icon: 'pi-home' },
          { to: '/dispatcher/trips', label: t('nav.trips'), icon: 'pi-calendar' },
          { to: '/dispatcher/tracking', label: t('nav.tracking'), icon: 'pi-map' },
          { to: '/dispatcher/bookings', label: t('nav.bookings'), icon: 'pi-ticket' },
        ],
      },
    ];
  const s = [
    {
      title: t('nav.overview'),
      items: [
        { to: '/admin', label: t('nav.overview'), icon: 'pi-home' },
        { to: '/admin/tracking', label: t('nav.tracking'), icon: 'pi-map' },
      ],
    },
    {
      title: t('nav.operations'),
      items: [
        { to: '/admin/trips', label: t('nav.trips'), icon: 'pi-calendar' },
        { to: '/admin/bookings', label: t('nav.bookings'), icon: 'pi-ticket' },
        { to: '/admin/tickets', label: t('nav.tickets'), icon: 'pi-qrcode' },
        { to: '/admin/pricing', label: t('nav.pricing'), icon: 'pi-wallet' },
      ],
    },
    {
      title: t('nav.management'),
      items: [
        { to: '/admin/buses', label: t('nav.buses'), icon: 'pi-car' },
        { to: '/admin/routes', label: t('nav.routes'), icon: 'pi-directions' },
        { to: '/admin/stops', label: t('nav.stops'), icon: 'pi-map-marker' },
        { to: '/admin/drivers', label: t('nav.drivers'), icon: 'pi-id-card' },
        { to: '/admin/users', label: t('nav.users'), icon: 'pi-users', perm: 'users.read' },
        { to: '/admin/responsibles', label: t('nav.responsibles'), icon: 'pi-user-plus' },
      ],
    },
    {
      title: t('nav.analytics'),
      items: [
        { to: '/admin/reports', label: t('nav.reports'), icon: 'pi-chart-bar' },
        { to: '/admin/audit', label: t('nav.audit'), icon: 'pi-history' },
        { to: '/admin/notifications', label: t('nav.notifications'), icon: 'pi-bell' },
      ],
    },
    { title: t('nav.system'), items: [{ to: '/admin/settings', label: t('nav.settings'), icon: 'pi-cog' }] },
  ];
  return s.map((x) => ({ ...x, items: x.items.filter((i: NavItem) => !i.perm || auth.can(i.perm)) }));
});

const exact = (to: string) => ['/admin', '/dispatcher', '/driver'].includes(to);
const isActive = (to: string) => (exact(to) ? route.path === to : route.path.startsWith(to));
</script>

<template>
  <div class="flex min-h-screen">
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col lg:flex" style="background: var(--sidebar-bg); color: var(--sidebar-text)">
      <RouterLink to="/" class="flex h-16 items-center gap-2 px-5">
        <img src="/favicon.svg" alt="" class="h-8 w-8" />
        <span class="text-lg font-bold text-white">BusLine</span>
        <span class="ml-auto rounded bg-teal-700/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-teal-100 uppercase">{{ area }}</span>
      </RouterLink>
      <nav class="flex-1 overflow-y-auto px-3 pb-6">
        <div v-for="s in sections" :key="s.title" class="mt-4">
          <div class="px-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{{ s.title }}</div>
          <RouterLink
            v-for="i in s.items"
            :key="i.to"
            :to="i.to"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition"
            :class="isActive(i.to) ? 'bg-teal-700 text-white' : 'hover:bg-white/5 hover:text-white'"
          >
            <i :class="['pi', i.icon]" class="text-sm" />
            {{ i.label }}
          </RouterLink>
        </div>
      </nav>
    </aside>

    <Drawer v-model:visible="ui.sidebarOpen" class="!w-72" :pt="{ root: { style: 'background: var(--sidebar-bg); color: var(--sidebar-text)' } }">
      <template #header><span class="text-lg font-bold text-white">BusLine</span></template>
      <div v-for="s in sections" :key="s.title" class="mt-3">
        <div class="px-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{{ s.title }}</div>
        <RouterLink
          v-for="i in s.items"
          :key="i.to"
          :to="i.to"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
          :class="isActive(i.to) ? 'bg-teal-700 text-white' : 'hover:bg-white/5'"
          @click="ui.sidebarOpen = false"
        >
          <i :class="['pi', i.icon]" />{{ i.label }}
        </RouterLink>
      </div>
    </Drawer>

    <div class="flex min-w-0 flex-1 flex-col lg:pl-64">
      <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 backdrop-blur md:px-6" style="border-color: var(--app-border); background: color-mix(in srgb, var(--app-surface) 90%, transparent)">
        <Button class="lg:!hidden" text rounded severity="secondary" icon="pi pi-bars" @click="ui.sidebarOpen = true" />
        <RouterLink to="/" class="muted hidden items-center gap-1 text-sm hover:text-teal-700 sm:flex"><i class="pi pi-globe" /> {{ t('nav.home') }}</RouterLink>
        <div class="ml-auto flex items-center gap-2">
          <LanguageSwitcher class="hidden sm:inline-flex" />
          <Button text rounded severity="secondary" :icon="ui.dark ? 'pi pi-sun' : 'pi pi-moon'" @click="ui.dark = !ui.dark" />
          <NotificationBell />
          <UserMenu />
        </div>
      </header>
      <main class="min-w-0 flex-1 p-4 md:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
