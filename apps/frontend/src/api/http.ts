import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const http = axios.create({ baseURL: '/api', timeout: 20000 });

const TOKEN = 'bus.token';
const REFRESH = 'bus.refresh';

export const tokens = {
  get access() {
    return localStorage.getItem(TOKEN);
  },
  get refresh() {
    return localStorage.getItem(REFRESH);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(TOKEN, access);
    localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(TOKEN);
    localStorage.removeItem(REFRESH);
  },
};

http.interceptors.request.use((config) => {
  const token = tokens.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['Accept-Language'] = localStorage.getItem('bus.lang') || 'uz';
  return config;
});

let refreshing: Promise<string | null> | null = null;
let onSessionExpired: () => void = () => undefined;

export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

async function refreshToken() {
  const refresh = tokens.refresh;
  if (!refresh) return null;
  try {
    const { data } = await axios.post('/api/auth/refresh', { refreshToken: refresh });
    tokens.set(data.accessToken, data.refreshToken);
    return data.accessToken as string;
  } catch {
    tokens.clear();
    return null;
  }
}

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const url = original?.url ?? '';
    if (error.response?.status === 401 && original && !original._retry && !url.startsWith('/auth/')) {
      original._retry = true;
      refreshing ??= refreshToken().finally(() => (refreshing = null));
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return http(original);
      }
      onSessionExpired();
    }
    return Promise.reject(error);
  },
);

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export function apiError(err: unknown): ApiError {
  const e = err as AxiosError<any>;
  const data = e?.response?.data;
  if (data?.code) return { code: data.code, message: data.message ?? data.code, details: data.details };
  return { code: 'NETWORK', message: e?.message ?? 'Network error' };
}
