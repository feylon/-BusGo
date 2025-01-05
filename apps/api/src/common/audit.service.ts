import { Injectable } from '@nestjs/common';
import { AuditLogPayload, Events } from '@bus/events';
import { EventsService } from './events.service';

const SECRET_KEYS = ['password', 'passwordHash', 'code', 'otp', 'token', 'refreshToken', 'qrToken'];

export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEYS.includes(k) ? '***' : sanitize(v, depth + 1);
  }
  return out;
}

@Injectable()
export class AuditService {
  constructor(private readonly events: EventsService) {}

  log(entry: Partial<AuditLogPayload> & { action: string }, correlationId?: string) {
    const payload: AuditLogPayload = {
      userId: entry.userId ?? null,
      userRole: entry.userRole ?? null,
      action: entry.action,
      entity: entry.entity ?? null,
      entityId: entry.entityId ?? null,
      method: entry.method ?? null,
      endpoint: entry.endpoint ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      metadata: (sanitize(entry.metadata ?? {}) as Record<string, unknown>) ?? {},
      createdAt: new Date().toISOString(),
    };
    this.events.emitLater(Events.AuditLog, payload, correlationId);
  }

  fromRequest(req: any, entry: Partial<AuditLogPayload> & { action: string }) {
    const user = req.user;
    this.log(
      {
        userId: user?.id ?? null,
        userRole: user?.roles?.[0] ?? null,
        method: req.method,
        endpoint: req.originalUrl ?? req.url,
        ipAddress: clientIp(req),
        userAgent: req.headers['user-agent'] ?? null,
        ...entry,
      },
      req.correlationId,
    );
  }
}

export function clientIp(req: any): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? null;
}
