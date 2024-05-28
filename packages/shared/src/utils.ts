import { randomInt } from 'node:crypto';

export function normalizePhone(input: string): string | null {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 9) digits = `998${digits}`;
  if (digits.length === 10 && digits.startsWith('8')) digits = `998${digits.slice(1)}`;
  if (!/^998\d{9}$/.test(digits)) return null;
  return digits;
}

export function formatPhone(phone: string) {
  const p = normalizePhone(phone);
  if (!p) return phone;
  return `+${p.slice(0, 3)} ${p.slice(3, 5)} ${p.slice(5, 8)} ${p.slice(8, 10)} ${p.slice(10)}`;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function randomDigits(length: number) {
  let out = '';
  for (let i = 0; i < length; i++) out += randomInt(0, 10).toString();
  return out;
}

export function randomCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[randomInt(0, chars.length)];
  return out;
}

export function paginate(query: { page?: number | string; limit?: number | string }, maxLimit = 100) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const CORRELATION_HEADER = 'x-correlation-id';
export const INTERNAL_TOKEN_HEADER = 'x-internal-token';
