import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { PaymentStatus } from '@bus/types';
import { ServiceBus } from '@bus/shared';

const DB = process.env.TEST_PAYMENT_DATABASE_URL;
const suite = DB ? describe : describe.skip;
if (DB) process.env.DATABASE_URL = DB;

suite('payment service (integration)', () => {
  let app: INestApplication;
  let payments: any;
  const emitted: { type: string; payload: any }[] = [];

  beforeAll(async () => {
    const { dataSourceOptions } = await import('../src/data-source');
    const setup = new DataSource(dataSourceOptions());
    await setup.initialize();
    await setup.dropDatabase();
    await setup.destroy();
    const { AppModule } = await import('../src/app.module');
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ServiceBus)
      .useValue({ emit: async (type: string, payload: any) => void emitted.push({ type, payload }), on: () => undefined, connected: true })
      .compile();
    app = ref.createNestApplication();
    await app.init();
    const { PaymentsService } = await import('../src/payments.service');
    payments = app.get(PaymentsService);
  });

  afterAll(() => app?.close());

  const input = () => ({ bookingId: randomUUID(), userId: randomUUID(), amount: 80000, provider: 'mock' });

  it('creates a pending mock payment and reuses it for the same booking', async () => {
    const data = input();
    const p1 = await payments.create(data);
    const p2 = await payments.create(data);
    expect(p1.status).toBe(PaymentStatus.PENDING);
    expect(p1.transactionId).toMatch(/^MOCK-/);
    expect(p2.id).toBe(p1.id);
    expect(emitted.filter((e) => e.type === 'payment.created')).toHaveLength(1);
  });

  it('marks success and publishes payment.succeeded exactly once', async () => {
    const p = await payments.create(input());
    const done = await payments.complete(p.id, true);
    const again = await payments.complete(p.id, true);
    expect(done.status).toBe(PaymentStatus.SUCCEEDED);
    expect(again.status).toBe(PaymentStatus.SUCCEEDED);
    expect(emitted.filter((e) => e.type === 'payment.succeeded' && e.payload.paymentId === p.id)).toHaveLength(1);
    const details = await payments.details(p.id);
    expect(details.history.map((h: any) => h.toStatus)).toEqual(['PENDING', 'PROCESSING', 'SUCCEEDED']);
  });

  it('marks failure and allows a new attempt for the booking', async () => {
    const data = input();
    const p = await payments.create(data);
    const failed = await payments.complete(p.id, false);
    expect(failed.status).toBe(PaymentStatus.FAILED);
    expect(failed.failureReason).toBe('CARD_DECLINED');
    expect(emitted.some((e) => e.type === 'payment.failed' && e.payload.paymentId === p.id)).toBe(true);
    const retry = await payments.create(data);
    expect(retry.id).not.toBe(p.id);
  });

  it('refunds succeeded payments and cancels pending ones', async () => {
    const p = await payments.create(input());
    await payments.complete(p.id, true);
    const refunded = await payments.refund(p.id, 'TRIP_CANCELLED');
    expect(refunded.status).toBe(PaymentStatus.REFUNDED);
    expect(emitted.some((e) => e.type === 'payment.refunded' && e.payload.paymentId === p.id)).toBe(true);
    const pending = await payments.create(input());
    expect((await payments.refund(pending.id)).status).toBe(PaymentStatus.CANCELLED);
    await expect(payments.complete(pending.id, true)).rejects.toMatchObject({ code: 'PAYMENT_INVALID_STATUS' });
  });

  it('cancels payments after timeout', async () => {
    const p = await payments.create({ ...input(), expiresAt: new Date(Date.now() - 1000).toISOString() });
    const res = await payments.expire();
    expect(res.cancelled).toBeGreaterThanOrEqual(1);
    expect((await payments.get(p.id)).status).toBe(PaymentStatus.CANCELLED);
  });
});
