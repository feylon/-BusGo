export type Target = 'api' | 'payment' | 'tracking' | 'notification' | 'audit' | 'reporting';

export interface JobDef {
  name: string;
  description: string;
  every?: number;
  cron?: string;
  calls: { target: Target; path: string }[];
}

export const JOBS: JobDef[] = [
  {
    name: 'seat-lock-expiration',
    description: 'Release expired temporary seat locks',
    every: 30_000,
    calls: [{ target: 'api', path: '/api/internal/jobs/seat-lock-expiration' }],
  },
  {
    name: 'booking-expiration',
    description: 'Expire unpaid bookings after payment timeout',
    every: 60_000,
    calls: [{ target: 'api', path: '/api/internal/jobs/booking-expiration' }],
  },
  {
    name: 'payment-timeout',
    description: 'Cancel payments that were not completed in time',
    every: 60_000,
    calls: [{ target: 'payment', path: '/jobs/payment-timeout' }],
  },
  {
    name: 'trip-reminder',
    description: 'Send reminders to passengers before departure',
    every: 300_000,
    calls: [{ target: 'api', path: '/api/internal/jobs/trip-reminder' }],
  },
  {
    name: 'trip-status-update',
    description: 'Move trips to boarding and auto-complete stale trips',
    every: 60_000,
    calls: [{ target: 'api', path: '/api/internal/jobs/trip-status-update' }],
  },
  {
    name: 'delayed-trip-check',
    description: 'Mark trips that did not depart on time as delayed',
    every: 120_000,
    calls: [{ target: 'api', path: '/api/internal/jobs/delayed-trip-check' }],
  },
  {
    name: 'daily-report',
    description: 'Build yesterday summary in reporting service',
    cron: '10 0 * * *',
    calls: [{ target: 'reporting', path: '/jobs/daily-report' }],
  },
  {
    name: 'cleanup',
    description: 'Remove old tracking points, read notifications and audit logs',
    cron: '30 3 * * *',
    calls: [
      { target: 'tracking', path: '/jobs/cleanup' },
      { target: 'notification', path: '/jobs/cleanup' },
      { target: 'audit', path: '/jobs/cleanup' },
    ],
  },
];
