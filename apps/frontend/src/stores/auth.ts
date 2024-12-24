import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { RoleName } from '@bus/types';
import { api } from '@/api';
import { tokens } from '@/api/http';
import { reconnectSocket } from '@/composables/useSocket';

export interface Profile {
  id: string;
  phone: string;
  email: string | null;
  fullName: string;
  lang: string;
  roles: string[];
  permissions: string[];
  driverId: string | null;
}

export const STAFF_ROLES: string[] = [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.DISPATCHER];

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(tokens.access);
  const user = ref<Profile | null>(JSON.parse(localStorage.getItem('bus.user') || 'null'));

  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const roles = computed(() => user.value?.roles ?? []);
  const hasRole = (...r: string[]) => roles.value.some((x) => r.includes(x));
  const can = (perm: string) => roles.value.includes(RoleName.SUPER_ADMIN) || !!user.value?.permissions.includes(perm);
  const isAdmin = computed(() => hasRole(RoleName.SUPER_ADMIN, RoleName.ADMIN));
  const isStaff = computed(() => hasRole(...STAFF_ROLES));

  const homeRoute = computed(() => {
    if (hasRole(RoleName.SUPER_ADMIN, RoleName.ADMIN)) return '/admin';
    if (hasRole(RoleName.DISPATCHER)) return '/dispatcher';
    if (hasRole(RoleName.DRIVER)) return '/driver';
    return '/dashboard';
  });

  function setSession(data: { accessToken: string; refreshToken: string; user: Profile }) {
    tokens.set(data.accessToken, data.refreshToken);
    token.value = data.accessToken;
    setUser(data.user);
    reconnectSocket();
  }

  function setUser(u: Profile | null) {
    user.value = u;
    localStorage.setItem('bus.user', JSON.stringify(u));
    if (u?.lang) localStorage.setItem('bus.lang', u.lang);
  }

  async function login(login: string, password: string) {
    setSession(await api.auth.login(login, password));
  }

  async function loginWithOtp(phone: string, code: string, fullName?: string) {
    setSession(await api.auth.verifyOtp(phone, code, fullName));
  }

  async function register(body: object) {
    setSession(await api.auth.register(body));
  }

  async function fetchMe() {
    setUser(await api.auth.me());
  }

  async function logout() {
    if (token.value) await api.auth.logout(tokens.refresh).catch(() => undefined);
    clear();
  }

  function clear() {
    tokens.clear();
    token.value = null;
    setUser(null);
    reconnectSocket();
  }

  return { token, user, isAuthenticated, roles, hasRole, can, isAdmin, isStaff, homeRoute, login, loginWithOtp, register, fetchMe, logout, clear, setUser };
});
