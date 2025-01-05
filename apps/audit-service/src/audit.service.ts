import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AuditLogPayload, Events } from '@bus/events';
import { AppException, ServiceBus, paginate } from '@bus/shared';
import { AuditLog } from './audit-log.entity';

export interface AuditQuery {
  page?: number;
  limit?: number;
  search?: string;
  userId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  role?: string;
  ip?: string;
  from?: string;
  to?: string;
}

const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);

@Injectable()
export class AuditService implements OnModuleInit {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
    private readonly bus: ServiceBus,
  ) {}

  onModuleInit() {
    this.bus.on<AuditLogPayload>(Events.AuditLog, async (e) => {
      const p = e.payload;
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(AuditLog)
        .values({
          eventId: e.id,
          userId: isUuid(p.userId ?? undefined) ? p.userId : null,
          userRole: p.userRole,
          action: p.action,
          entity: p.entity,
          entityId: p.entityId ? String(p.entityId).slice(0, 64) : null,
          method: p.method,
          endpoint: p.endpoint?.slice(0, 255) ?? null,
          ipAddress: p.ipAddress?.slice(0, 64) ?? null,
          userAgent: p.userAgent?.slice(0, 255) ?? null,
          metadata: (p.metadata ?? {}) as Record<string, any>,
          correlationId: isUuid(e.correlationId) ? e.correlationId : null,
          createdAt: new Date(p.createdAt ?? e.occurredAt),
        })
        .orIgnore()
        .execute();
    });
  }

  async list(q: AuditQuery) {
    const { page, limit, skip } = paginate(q);
    const qb = this.repo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC').skip(skip).take(limit);
    if (isUuid(q.userId)) qb.andWhere('a.userId = :userId', { userId: q.userId });
    if (q.action) qb.andWhere('a.action = :action', { action: q.action });
    if (q.entity) qb.andWhere('a.entity = :entity', { entity: q.entity });
    if (q.entityId) qb.andWhere('a.entityId = :entityId', { entityId: q.entityId });
    if (q.role) qb.andWhere('a.userRole = :role', { role: q.role });
    if (q.ip) qb.andWhere('a.ipAddress ILIKE :ip', { ip: `${q.ip}%` });
    if (q.from) qb.andWhere(`(a.createdAt AT TIME ZONE 'Asia/Tashkent')::date >= :from`, { from: q.from });
    if (q.to) qb.andWhere(`(a.createdAt AT TIME ZONE 'Asia/Tashkent')::date <= :to`, { to: q.to });
    if (q.search)
      qb.andWhere('(a.action ILIKE :s OR a.endpoint ILIKE :s OR a.entity ILIKE :s OR a.entityId ILIKE :s OR a.metadata::text ILIKE :s)', {
        s: `%${q.search}%`,
      });
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async get(id: string) {
    const log = await this.repo.findOne({ where: { id } });
    if (!log) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return log;
  }

  async actions() {
    const rows = await this.repo
      .createQueryBuilder('a')
      .select('a.action', 'action')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('a.action')
      .orderBy('a.action')
      .getRawMany();
    const entities = await this.repo.createQueryBuilder('a').select('DISTINCT a.entity', 'entity').where('a.entity IS NOT NULL').getRawMany();
    return { actions: rows, entities: entities.map((e) => e.entity) };
  }

  async cleanup(days = Number(process.env.AUDIT_RETENTION_DAYS) || 365) {
    const res = await this.repo.delete({ createdAt: LessThan(new Date(Date.now() - days * 86400000)) });
    return { deleted: res.affected ?? 0 };
  }
}
