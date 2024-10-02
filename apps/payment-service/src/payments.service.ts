import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import { PaymentStatus } from '@bus/types';
import { Events, PaymentEventPayload } from '@bus/events';
import { AppException, ServiceBus, paginate } from '@bus/shared';
import { Payment } from './payment.entity';
import { PaymentLog } from './payment-log.entity';
import { PAYMENT_PROVIDERS, PaymentProvider } from './payment.provider';

const OPEN = [PaymentStatus.PENDING, PaymentStatus.PROCESSING];

export interface CreatePaymentInput {
  bookingId: string;
  userId: string;
  amount: number;
  currency?: string;
  provider?: string;
  expiresAt?: string | null;
  description?: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private readonly repo: Repository<Payment>,
    @InjectRepository(PaymentLog) private readonly logs: Repository<PaymentLog>,
    @Inject(PAYMENT_PROVIDERS) private readonly providers: Map<string, PaymentProvider>,
    private readonly bus: ServiceBus,
    private readonly ds: DataSource,
  ) {}

  private provider(name: string) {
    const p = this.providers.get(name);
    if (!p) throw new AppException('VALIDATION_ERROR', HttpStatus.BAD_REQUEST, [`Unknown provider ${name}`]);
    return p;
  }

  async create(input: CreatePaymentInput, correlationId?: string) {
    const providerName = input.provider ?? 'mock';
    const provider = this.provider(providerName);
    const existing = await this.repo.findOne({
      where: { bookingId: input.bookingId, status: In([...OPEN, PaymentStatus.SUCCEEDED]) },
      order: { createdAt: 'DESC' },
    });
    if (existing) return existing;
    const payment = await this.repo.save(
      this.repo.create({
        bookingId: input.bookingId,
        userId: input.userId,
        amount: input.amount,
        currency: input.currency ?? 'UZS',
        provider: providerName,
        status: PaymentStatus.PENDING,
        description: input.description ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + 15 * 60000),
      }),
    );
    const checkout = await provider.createCheckout(payment);
    payment.transactionId = checkout.transactionId;
    payment.checkoutUrl = checkout.checkoutUrl;
    await this.repo.save(payment);
    await this.logs.insert({ paymentId: payment.id, fromStatus: null, toStatus: PaymentStatus.PENDING, note: 'created' });
    await this.publish(Events.PaymentCreated, payment, undefined, correlationId);
    return payment;
  }

  async get(id: string) {
    const payment = await this.repo.findOne({ where: { id } });
    if (!payment) throw new AppException('PAYMENT_NOT_FOUND', HttpStatus.NOT_FOUND);
    return payment;
  }

  async details(id: string) {
    const payment = await this.get(id);
    const history = await this.logs.find({ where: { paymentId: id }, order: { createdAt: 'ASC' } });
    return { ...payment, history };
  }

  async list(q: { page?: number; limit?: number; status?: string; bookingId?: string; userId?: string; search?: string }) {
    const { page, limit, skip } = paginate(q);
    const qb = this.repo.createQueryBuilder('p').orderBy('p.createdAt', 'DESC').skip(skip).take(limit);
    if (q.status) qb.andWhere('p.status = :status', { status: q.status });
    if (q.bookingId) qb.andWhere('p.bookingId = :bookingId', { bookingId: q.bookingId });
    if (q.userId) qb.andWhere('p.userId = :userId', { userId: q.userId });
    if (q.search) qb.andWhere('(p.transactionId ILIKE :s OR p.description ILIKE :s)', { s: `%${q.search}%` });
    const [items, total] = await qb.getManyAndCount();
    const totals = await this.repo
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(p.amount),0)::bigint', 'amount')
      .groupBy('p.status')
      .getRawMany();
    return { items, total, page, limit, totals: totals.map((t) => ({ ...t, amount: Number(t.amount) })) };
  }

  private async transition(id: string, from: PaymentStatus[], to: PaymentStatus, patch: Partial<Payment>, note?: string) {
    return this.ds.transaction(async (m) => {
      const payment = await m.createQueryBuilder(Payment, 'p').setLock('pessimistic_write').where('p.id = :id', { id }).getOne();
      if (!payment) throw new AppException('PAYMENT_NOT_FOUND', HttpStatus.NOT_FOUND);
      if (payment.status === to) return { payment, changed: false };
      if (!from.includes(payment.status)) throw new AppException('PAYMENT_INVALID_STATUS', HttpStatus.CONFLICT, { status: payment.status });
      const prev = payment.status;
      Object.assign(payment, patch, { status: to });
      await m.save(payment);
      await m.insert(PaymentLog, { paymentId: id, fromStatus: prev, toStatus: to, note: note ?? null });
      return { payment, changed: true };
    });
  }

  async complete(id: string, success: boolean, correlationId?: string) {
    const payment = await this.get(id);
    if (payment.status === PaymentStatus.SUCCEEDED || payment.status === PaymentStatus.FAILED) return payment;
    if (!OPEN.includes(payment.status)) throw new AppException('PAYMENT_INVALID_STATUS', HttpStatus.CONFLICT, { status: payment.status });
    await this.transition(id, [PaymentStatus.PENDING], PaymentStatus.PROCESSING, {}, 'processing');
    const result = await this.provider(payment.provider).confirm(payment, success);
    if (result.success) {
      const { payment: done, changed } = await this.transition(id, OPEN, PaymentStatus.SUCCEEDED, { paidAt: new Date(), failureReason: null }, 'paid');
      if (changed) await this.publish(Events.PaymentSucceeded, done, undefined, correlationId);
      return done;
    }
    const { payment: failed, changed } = await this.transition(id, OPEN, PaymentStatus.FAILED, { failureReason: result.reason ?? 'DECLINED' }, result.reason);
    if (changed) await this.publish(Events.PaymentFailed, failed, result.reason, correlationId);
    return failed;
  }

  async refund(id: string, reason?: string, correlationId?: string) {
    const payment = await this.get(id);
    if (OPEN.includes(payment.status)) return this.cancel(id, reason, correlationId);
    if (payment.status === PaymentStatus.REFUNDED) return payment;
    await this.provider(payment.provider).refund(payment);
    const { payment: done, changed } = await this.transition(id, [PaymentStatus.SUCCEEDED], PaymentStatus.REFUNDED, { refundedAt: new Date() }, reason ?? 'refund');
    if (changed) await this.publish(Events.PaymentRefunded, done, reason, correlationId);
    return done;
  }

  async cancel(id: string, reason?: string, _correlationId?: string) {
    const payment = await this.get(id);
    if (!OPEN.includes(payment.status)) return payment;
    const { payment: done } = await this.transition(id, OPEN, PaymentStatus.CANCELLED, { failureReason: reason ?? 'CANCELLED' }, reason ?? 'cancelled');
    return done;
  }

  async expire() {
    const due = await this.repo.find({ where: { status: In(OPEN), expiresAt: LessThan(new Date()) }, take: 500 });
    for (const p of due) {
      const { payment, changed } = await this.transition(p.id, OPEN, PaymentStatus.CANCELLED, { failureReason: 'TIMEOUT' }, 'timeout');
      if (changed) await this.publish(Events.PaymentFailed, payment, 'TIMEOUT');
    }
    return { cancelled: due.length };
  }

  private publish(type: string, p: Payment, reason?: string, correlationId?: string) {
    return this.bus.emit<PaymentEventPayload>(
      type,
      {
        paymentId: p.id,
        bookingId: p.bookingId,
        userId: p.userId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        transactionId: p.transactionId,
        reason,
        occurredAt: new Date().toISOString(),
      },
      correlationId,
    );
  }
}
