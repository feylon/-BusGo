import { http } from './http';

const get = <T = any>(url: string, params?: object) => http.get<T>(url, { params }).then((r) => r.data);
const post = <T = any>(url: string, body?: object) => http.post<T>(url, body ?? {}).then((r) => r.data);
const patch = <T = any>(url: string, body?: object) => http.patch<T>(url, body ?? {}).then((r) => r.data);
const put = <T = any>(url: string, body?: object) => http.put<T>(url, body ?? {}).then((r) => r.data);
const del = <T = any>(url: string) => http.delete<T>(url).then((r) => r.data);

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export const api = {
  auth: {
    login: (login: string, password: string) => post('/auth/login', { login, password }),
    sendOtp: (phone: string, purpose = 'LOGIN') => post('/auth/otp/send', { phone, purpose }),
    verifyOtp: (phone: string, code: string, fullName?: string) => post('/auth/otp/verify', { phone, code, fullName }),
    register: (body: object) => post('/auth/register', body),
    logout: (refreshToken?: string | null) => post('/auth/logout', { refreshToken }),
    me: () => get('/auth/me'),
    update: (body: object) => patch('/auth/me', body),
    password: (body: object) => patch('/auth/me/password', body),
  },
  settings: {
    public: () => get('/settings/public'),
    all: () => get('/settings'),
    update: (body: object) => put('/settings', body),
  },
  users: {
    list: (q: object) => get<Page<any>>('/users', q),
    create: (body: object) => post('/users', body),
    update: (id: string, body: object) => patch(`/users/${id}`, body),
    remove: (id: string) => del(`/users/${id}`),
    roles: () => get<any[]>('/roles'),
    permissions: () => get<any[]>('/permissions'),
    setRolePermissions: (id: string, permissions: string[]) => put(`/roles/${id}/permissions`, { permissions }),
  },
  drivers: {
    list: (q: object) => get<Page<any>>('/drivers', q),
    get: (id: string) => get(`/drivers/${id}`),
    create: (body: object) => post('/drivers', body),
    update: (id: string, body: object) => patch(`/drivers/${id}`, body),
  },
  passengers: {
    list: (q: object) => get<Page<any>>('/passengers', q),
    mine: () => get<any[]>('/passengers/mine'),
  },
  buses: {
    list: (q: object) => get<Page<any>>('/buses', q),
    get: (id: string) => get(`/buses/${id}`),
    create: (body: object) => post('/buses', body),
    update: (id: string, body: object) => patch(`/buses/${id}`, body),
    remove: (id: string) => del(`/buses/${id}`),
    saveLayout: (id: string, layout: object) => put(`/buses/${id}/layout`, layout),
    updateSeat: (id: string, seatId: string, body: object) => patch(`/buses/${id}/seats/${seatId}`, body),
  },
  stops: {
    list: (q: object = {}) => get<Page<any>>('/stops', q),
    cities: () => get<{ city: string; stops: number }[]>('/stops/cities'),
    create: (body: object) => post('/stops', body),
    update: (id: string, body: object) => patch(`/stops/${id}`, body),
    remove: (id: string) => del(`/stops/${id}`),
  },
  routes: {
    list: (q: object = {}) => get<Page<any>>('/routes', q),
    get: (id: string) => get(`/routes/${id}`),
    create: (body: object) => post('/routes', body),
    update: (id: string, body: object) => patch(`/routes/${id}`, body),
    remove: (id: string) => del(`/routes/${id}`),
  },
  pricing: {
    list: (q: object) => get<Page<any>>('/pricing', q),
    create: (body: object) => post('/pricing', body),
    update: (id: string, body: object) => patch(`/pricing/${id}`, body),
    remove: (id: string) => del(`/pricing/${id}`),
  },
  trips: {
    search: (q: object) => get<any[]>('/trips/search', q),
    list: (q: object) => get<Page<any>>('/trips', q),
    get: (id: string) => get(`/trips/${id}`),
    seats: (id: string, q: object = {}) => get(`/trips/${id}/seats`, q),
    lock: (id: string, seatId: string) => post(`/trips/${id}/seats/${seatId}/lock`),
    unlock: (id: string, seatId: string) => del(`/trips/${id}/seats/${seatId}/lock`),
    create: (body: object) => post('/trips', body),
    generate: (body: object) => post('/trips/generate', body),
    update: (id: string, body: object) => patch(`/trips/${id}`, body),
    assignDriver: (id: string, driverId: string) => patch(`/trips/${id}/driver`, { driverId }),
    boarding: (id: string) => post(`/trips/${id}/boarding`),
    start: (id: string) => post(`/trips/${id}/start`),
    delay: (id: string, minutes: number, reason?: string) => post(`/trips/${id}/delay`, { minutes, reason }),
    complete: (id: string) => post(`/trips/${id}/complete`),
    cancel: (id: string, reason?: string) => post(`/trips/${id}/cancel`, { reason }),
    passengers: (id: string) => get<any[]>(`/trips/${id}/passengers`),
  },
  bookings: {
    create: (body: object) => post('/bookings', body),
    mine: (q: object = {}) => get<Page<any>>('/bookings/my', q),
    list: (q: object) => get<Page<any>>('/bookings', q),
    get: (id: string) => get(`/bookings/${id}`),
    cancel: (id: string, reason?: string) => post(`/bookings/${id}/cancel`, { reason }),
    pay: (id: string) => post(`/bookings/${id}/pay`, { provider: 'mock' }),
  },
  payments: {
    list: (q: object) => get('/payments', q),
    get: (id: string) => get(`/payments/${id}`),
    mockComplete: (id: string, success: boolean) => post(`/payments/${id}/mock/complete`, { success }),
    refund: (id: string, reason?: string) => post(`/payments/${id}/refund`, { reason }),
  },
  tickets: {
    mine: (q: object = {}) => get<Page<any>>('/tickets/my', q),
    list: (q: object) => get<Page<any>>('/tickets', q),
    get: (id: string) => get(`/tickets/${id}`),
    verify: (token: string, tripId?: string) => post('/tickets/verify', { token, tripId }),
  },
  responsibles: {
    list: (q: object) => get<Page<any>>('/responsibles', q),
    create: (body: object) => post('/responsibles', body),
    update: (id: string, body: object) => patch(`/responsibles/${id}`, body),
    remove: (id: string) => del(`/responsibles/${id}`),
  },
  notifications: {
    list: (q: object = {}) => get('/notifications', q),
    unread: () => get<{ count: number }>('/notifications/unread-count'),
    read: (id: string) => patch(`/notifications/${id}/read`),
    readAll: () => patch('/notifications/read-all'),
    preferences: () => get('/notifications/preferences'),
    savePreferences: (body: object) => put('/notifications/preferences', body),
    all: (q: object) => get('/notifications/all', q),
    broadcast: (body: object) => post('/notifications/broadcast', body),
  },
  tracking: {
    current: (tripId: string) => get(`/tracking/${tripId}`),
    history: (tripId: string, limit = 500) => get<any[]>(`/tracking/${tripId}/history`, { limit }),
    vehicles: () => get<any[]>('/tracking/vehicles'),
    push: (body: object) => post('/tracking/location', body),
  },
  driver: {
    trips: (scope: string) => get<any[]>('/driver/trips', { scope }),
    passengers: (id: string) => get<any[]>(`/driver/trips/${id}/passengers`),
    boarding: (id: string) => post(`/driver/trips/${id}/boarding`),
    start: (id: string) => post(`/driver/trips/${id}/start`),
    finish: (id: string) => post(`/driver/trips/${id}/finish`),
  },
  reports: {
    live: () => get('/reports/live'),
    get: (name: string, q: object = {}) => get(`/reports/${name}`, q),
  },
  audit: {
    list: (q: object) => get<Page<any>>('/audit', q),
    actions: () => get('/audit/actions'),
  },
  health: {
    services: () => get('/health/services'),
  },
};
