import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, LessThan, Not, Repository } from 'typeorm';
import { NotificationChannel, NotificationType } from '@bus/types';
import {
  BookingEventPayload,
  EventEnvelope,
  Events,
  NotificationCreatedPayload,
  NotificationSendPayload,
  PaymentEventPayload,
  Recipient,
  SmsSendPayload,
  TicketEventPayload,
  TripEventPayload,
} from '@bus/events';
import { AppException, ServiceBus, paginate } from '@bus/shared';
import { Notification } from './notification.entity';
import { Preference } from './preference.entity';
import { Delivery } from './delivery.entity';
import { PUSH_PROVIDER, PushProvider } from './push.provider';
import { formatAmount, formatDate, render } from './templates';
import { idempotent } from './idempotent';

const SMS_TYPES = [NotificationType.BOOKING_CONFIRMED, NotificationType.TRIP_CANCELLED, NotificationType.TRIP_DELAYED];

interface Draft {
  type: NotificationType;
  recipients: Recipient[];
  params: Record<string, string | number | undefined>;
  data: Record<string, unknown>;
  channels?: NotificationChannel[];
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
    @InjectRepository(Preference) private readonly prefs: Repository<Preference>,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
    private readonly bus: ServiceBus,
    private readonly ds: DataSource,
  ) {}

  onModuleInit() {
    const on = <T>(event: string, map: (e: EventEnvelope<T>) => Draft | null) =>
      this.bus.on<T>(
        event,
        idempotent<T>(this.ds, `notify:${event}`, async (e, m) => {
          if ((e.payload as any)?.silent) return;
          const draft = map(e);
          if (draft?.recipients.length) await this.create(m, e, draft);
        }),
      );

    const booking = (type: NotificationType) => (e: EventEnvelope<BookingEventPayload>): Draft => ({
      type,
      recipients: [e.payload.recipient],
      params: {
        code: e.payload.code,
        route: e.payload.routeName,
        departure: formatDate(e.payload.departureAt),
        seats: e.payload.seats.join(', '),
        amount: formatAmount(e.payload.amount),
        minutes: 15,
      },
      data: { bookingId: e.payload.bookingId, tripId: e.payload.tripId },
    });
    on(Events.BookingCreated, booking(NotificationType.BOOKING_CREATED));
    on(Events.BookingConfirmed, booking(NotificationType.BOOKING_CONFIRMED));
    on(Events.BookingCancelled, (e: EventEnvelope<BookingEventPayload>) =>
      e.payload.reason === 'TRIP_CANCELLED' ? null : booking(NotificationType.BOOKING_CANCELLED)(e),
    );
    on(Events.BookingExpired, booking(NotificationType.BOOKING_EXPIRED));

    const payment = (type: NotificationType) => (e: EventEnvelope<PaymentEventPayload>): Draft => ({
      type,
      recipients: [{ userId: e.payload.userId }],
      params: { amount: formatAmount(e.payload.amount) },
      data: { paymentId: e.payload.paymentId, bookingId: e.payload.bookingId },
    });
    on(Events.PaymentSucceeded, payment(NotificationType.PAYMENT_SUCCESS));
    on(Events.PaymentFailed, (e: EventEnvelope<PaymentEventPayload>) =>
      e.payload.reason === 'TIMEOUT' ? null : payment(NotificationType.PAYMENT_FAILED)(e),
    );
    on(Events.PaymentRefunded, payment(NotificationType.PAYMENT_REFUNDED));

    const trip = (type: NotificationType) => (e: EventEnvelope<TripEventPayload>): Draft => ({
      type,
      recipients: e.payload.recipients ?? [],
      params: {
        route: e.payload.routeName,
        departure: formatDate(e.payload.departureAt),
        minutes: e.payload.delayMinutes,
        reason: e.payload.reason,
        bus: e.payload.busPlate,
      },
      data: { tripId: e.payload.tripId },
    });
    on(Events.TripReminder, trip(NotificationType.TRIP_REMINDER));
    on(Events.TripDelayed, trip(NotificationType.TRIP_DELAYED));
    on(Events.TripCancelled, trip(NotificationType.TRIP_CANCELLED));
    on(Events.TripStarted, trip(NotificationType.TRIP_STARTED));

    on(Events.TicketCreated, (e: EventEnvelope<TicketEventPayload>) => ({
      type: NotificationType.TICKET_CREATED,
      recipients: e.payload.recipient ? [e.payload.recipient] : [{ userId: e.payload.userId }],
      params: { ticket: e.payload.ticketNumber, seats: e.payload.seat },
      data: { ticketId: e.payload.ticketId, bookingId: e.payload.bookingId, tripId: e.payload.tripId },
    }));

    on(Events.NotificationSend, (e: EventEnvelope<NotificationSendPayload>) => ({
      type: e.payload.type,
      recipients: e.payload.recipients,
      params: e.payload.params,
      data: e.payload.data ?? {},
      channels: e.payload.channels,
    }));
  }

  private async create(m: EntityManager, e: EventEnvelope, draft: Draft) {
    const { title, body } = render(draft.type, draft.params);
    const created: Notification[] = [];
    for (const r of draft.recipients) {
      const pref = await m.findOne(Preference, { where: { userId: r.userId } });
      if (pref?.muted.includes(draft.type)) continue;
      const allowed = pref?.channels ?? [NotificationChannel.IN_APP, NotificationChannel.PUSH];
      const channels = (draft.channels ?? [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.SMS]).filter(
        (c) => c === NotificationChannel.IN_APP || allowed.includes(c),
      );
      const res = await m
        .createQueryBuilder()
        .insert()
        .into(Notification)
        .values({ userId: r.userId, type: draft.type, title, body, data: draft.data as Record<string, any>, channels, eventId: e.id })
        .orIgnore()
        .returning('*')
        .execute();
      const row = res.raw?.[0] as Notification | undefined;
      if (!row) continue;
      created.push(row);
      const lang = (r.lang ?? 'uz') as keyof typeof title;
      if (channels.includes(NotificationChannel.PUSH)) {
        await this.deliver(m, row.id, NotificationChannel.PUSH, this.push.name, () =>
          this.push.send({ userId: r.userId, title: title[lang], body: body[lang], data: draft.data }),
        );
      }
      if (channels.includes(NotificationChannel.SMS) && r.phone && (SMS_TYPES.includes(draft.type) || draft.channels?.includes(NotificationChannel.SMS))) {
        await this.deliver(m, row.id, NotificationChannel.SMS, 'sms-service', () =>
          this.bus.emit<SmsSendPayload>(Events.SmsSend, { phone: r.phone!, text: `${title[lang]}. ${body[lang]}` }, e.correlationId),
        );
      }
    }
    for (const n of created) {
      await this.bus.emit<NotificationCreatedPayload>(
        Events.NotificationCreated,
        { id: n.id, userId: n.userId, type: n.type, title: n.title, body: n.body, data: n.data, createdAt: new Date(n.createdAt).toISOString() },
        e.correlationId,
      );
    }
  }

  private async deliver(m: EntityManager, notificationId: string, channel: string, provider: string, send: () => Promise<unknown>) {
    try {
      await send();
      await m.insert(Delivery, { notificationId, channel, provider, status: 'SENT' });
    } catch (err) {
      this.logger.warn(`${channel} delivery failed: ${(err as Error).message}`);
      await m.insert(Delivery, { notificationId, channel, provider, status: 'FAILED', error: (err as Error).message.slice(0, 250) });
    }
  }

  async list(userId: string, q: { page?: number; limit?: number; unread?: boolean | string }) {
    const { page, limit, skip } = paginate(q);
    const where = { userId, ...(q.unread === true || q.unread === 'true' ? { readAt: IsNull() } : {}) };
    const [items, total] = await this.repo.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take: limit });
    return { items, total, page, limit, unread: await this.repo.count({ where: { userId, readAt: IsNull() } }) };
  }

  async all(q: { page?: number; limit?: number; search?: string }) {
    const { page, limit, skip } = paginate(q);
    const qb = this.repo.createQueryBuilder('n').orderBy('n.createdAt', 'DESC').skip(skip).take(limit);
    if (q.search) qb.where(`(n.type ILIKE :s OR n.title->>'uz' ILIKE :s OR n.body->>'uz' ILIKE :s)`, { s: `%${q.search}%` });
    const [items, total] = await qb.getManyAndCount();
    const stats = await this.repo
      .createQueryBuilder('n')
      .select('n.type', 'type')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('n.type')
      .getRawMany();
    return { items, total, page, limit, stats };
  }

  async unreadCount(userId: string) {
    return { count: await this.repo.count({ where: { userId, readAt: IsNull() } }) };
  }

  async read(id: string, userId: string) {
    const n = await this.repo.findOne({ where: { id, userId } });
    if (!n) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    if (!n.readAt) await this.repo.update(id, { readAt: new Date() });
    return { id, read: true };
  }

  async readAll(userId: string) {
    const res = await this.repo.update({ userId, readAt: IsNull() }, { readAt: new Date() });
    return { updated: res.affected ?? 0 };
  }

  async preferences(userId: string) {
    return (
      (await this.prefs.findOne({ where: { userId } })) ?? {
        userId,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        muted: [],
      }
    );
  }

  async updatePreferences(userId: string, dto: { channels: string[]; muted?: string[] }) {
    const channels = [...new Set([NotificationChannel.IN_APP, ...dto.channels])];
    await this.prefs.save({ userId, channels, muted: dto.muted ?? [] });
    return this.preferences(userId);
  }

  async cleanup(days = Number(process.env.NOTIFICATION_RETENTION_DAYS) || 90) {
    const before = new Date(Date.now() - days * 86400000);
    const res = await this.repo.delete({ createdAt: LessThan(before), readAt: Not(IsNull()) });
    await this.ds.query(`DELETE FROM processed_events WHERE "createdAt" < $1`, [before]);
    return { deleted: res.affected ?? 0 };
  }
}
