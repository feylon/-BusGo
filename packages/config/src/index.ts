export function env(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value !== undefined && value !== '') return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

export function envInt(name: string, fallback?: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  const value = Number(raw);
  if (Number.isNaN(value)) throw new Error(`Environment variable ${name} must be a number`);
  return value;
}

export function envBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export const isProd = () => process.env.NODE_ENV === 'production';

export function databaseOptions(urlVar = 'DATABASE_URL') {
  return {
    type: 'postgres' as const,
    url: env(urlVar),
    ssl: envBool('DATABASE_SSL') ? { rejectUnauthorized: false } : false,
    extra: { max: envInt('DATABASE_POOL_SIZE', 10) },
  };
}

export const ServicePorts = {
  api: 3000,
  notification: 3101,
  sms: 3102,
  audit: 3103,
  tracking: 3104,
  payment: 3105,
  scheduler: 3106,
  reporting: 3107,
} as const;
