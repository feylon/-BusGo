import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { RoleName } from '@bus/types';
import { useAuthStore } from '@/stores/auth';
import { setSessionExpiredHandler } from '@/api/http';
import PublicLayout from '@/layouts/PublicLayout.vue';
import DashboardLayout from '@/layouts/DashboardLayout.vue';

const ADMINS = [RoleName.SUPER_ADMIN, RoleName.ADMIN];
const DISPATCH = [...ADMINS, RoleName.DISPATCHER];

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: PublicLayout,
    children: [
      { path: '', name: 'home', component: () => import('@/views/public/HomeView.vue') },
      { path: 'routes', name: 'routes', component: () => import('@/views/public/RoutesView.vue') },
      { path: 'trips', name: 'trips', component: () => import('@/views/public/TripsView.vue') },
      { path: 'trip/:id', name: 'trip', component: () => import('@/views/public/TripView.vue') },
      { path: 'login', name: 'login', component: () => import('@/views/public/LoginView.vue'), meta: { guest: true } },
      { path: 'register', name: 'register', component: () => import('@/views/public/RegisterView.vue'), meta: { guest: true } },
      { path: 'payment/mock/:id', name: 'payment', component: () => import('@/views/public/PaymentView.vue'), meta: { auth: true } },
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/passenger/DashboardView.vue'), meta: { auth: true } },
      { path: 'my-bookings', name: 'my-bookings', component: () => import('@/views/passenger/MyBookingsView.vue'), meta: { auth: true } },
      { path: 'my-bookings/:id', name: 'booking', component: () => import('@/views/passenger/BookingView.vue'), meta: { auth: true } },
      { path: 'my-tickets', name: 'my-tickets', component: () => import('@/views/passenger/MyTicketsView.vue'), meta: { auth: true } },
      { path: 'profile', name: 'profile', component: () => import('@/views/passenger/ProfileView.vue'), meta: { auth: true } },
      { path: 'notifications', name: 'notifications', component: () => import('@/views/passenger/NotificationsView.vue'), meta: { auth: true } },
    ],
  },
  {
    path: '/admin',
    component: DashboardLayout,
    meta: { auth: true, roles: ADMINS, area: 'admin' },
    children: [
      { path: '', name: 'admin', component: () => import('@/views/admin/AdminDashboard.vue') },
      { path: 'users', component: () => import('@/views/admin/UsersView.vue') },
      { path: 'drivers', component: () => import('@/views/admin/DriversView.vue') },
      { path: 'buses', component: () => import('@/views/admin/BusesView.vue') },
      { path: 'buses/:id/seats', component: () => import('@/views/admin/SeatEditorView.vue') },
      { path: 'routes', component: () => import('@/views/admin/RoutesAdminView.vue') },
      { path: 'stops', component: () => import('@/views/admin/StopsView.vue') },
      { path: 'trips', component: () => import('@/views/admin/TripsAdminView.vue') },
      { path: 'pricing', component: () => import('@/views/admin/PricingView.vue') },
      { path: 'bookings', component: () => import('@/views/admin/BookingsAdminView.vue') },
      { path: 'tickets', component: () => import('@/views/admin/TicketsAdminView.vue') },
      { path: 'responsibles', component: () => import('@/views/admin/ResponsiblesView.vue') },
      { path: 'notifications', component: () => import('@/views/admin/NotificationsAdminView.vue') },
      { path: 'audit', component: () => import('@/views/admin/AuditView.vue') },
      { path: 'reports', component: () => import('@/views/admin/ReportsView.vue') },
      { path: 'tracking', component: () => import('@/views/dispatcher/TrackingView.vue') },
      { path: 'settings', component: () => import('@/views/admin/SettingsView.vue') },
    ],
  },
  {
    path: '/dispatcher',
    component: DashboardLayout,
    meta: { auth: true, roles: DISPATCH, area: 'dispatcher' },
    children: [
      { path: '', name: 'dispatcher', component: () => import('@/views/dispatcher/DispatcherDashboard.vue') },
      { path: 'trips', component: () => import('@/views/admin/TripsAdminView.vue') },
      { path: 'tracking', component: () => import('@/views/dispatcher/TrackingView.vue') },
      { path: 'bookings', component: () => import('@/views/admin/BookingsAdminView.vue') },
    ],
  },
  {
    path: '/driver',
    component: DashboardLayout,
    meta: { auth: true, roles: [RoleName.DRIVER], area: 'driver' },
    children: [
      { path: '', name: 'driver', component: () => import('@/views/driver/DriverDashboard.vue') },
      { path: 'trips', component: () => import('@/views/driver/DriverTripsView.vue') },
      { path: 'passengers', component: () => import('@/views/driver/DriverPassengersView.vue') },
      { path: 'qr', component: () => import('@/views/driver/QrScanView.vue') },
      { path: 'tracking', component: () => import('@/views/driver/DriverTrackingView.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  const needsAuth = to.matched.some((r) => r.meta.auth);
  if (needsAuth && !auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } };
  if (to.meta.guest && auth.isAuthenticated) return auth.homeRoute;
  const roles = to.matched.flatMap((r) => (r.meta.roles as string[] | undefined) ?? []);
  if (roles.length && !auth.hasRole(...roles)) return auth.homeRoute;
  return true;
});

setSessionExpiredHandler(() => {
  const auth = useAuthStore();
  auth.clear();
  const current = router.currentRoute.value;
  if (current.matched.some((r) => r.meta.auth)) router.push({ name: 'login', query: { redirect: current.fullPath, expired: '1' } });
});

export default router;
