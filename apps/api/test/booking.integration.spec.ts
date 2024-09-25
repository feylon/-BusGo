import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import {
  BookingStatus,
  BusStatus,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  RoleName,
  TicketStatus,
  TripSeatStatus,
  TripStatus,
  VerificationResult,
  buildStandardLayout,
} from '@bus/types';

const DB = process.env.TEST_DATABASE_URL;
const REDIS = process.env.TEST_REDIS_URL;
const suite = DB && REDIS ? describe : describe.skip;

if (DB && REDIS) {
  process.env.DATABASE_URL = DB;
  process.env.REDIS_URL = REDIS;
  process.env.EVENTS_DISABLED = 'true';
  process.env.REALTIME_DISABLED = 'true';
  process.env.RATE_LIMIT_PER_MIN = '100000';
}

suite('booking flow (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let services: Record<string, any>;
  const calls: { method: string; path: string; body?: any }[] = [];
  const otpCodes = new Map<string, string>();

  const fakeClient = (name: string) => ({
    post: async (path: string, body?: any) => {
      calls.push({ method: 'POST', path: `${name}${path}`, body });
      if (name === 'sms' && path === '/otp/send') {
        otpCodes.set(body.phone, '123456');
        return { phone: body.phone, expiresIn: 120, resendIn: 60 };
      }
      if (name === 'sms' && path === '/otp/verify') {
        if (otpCodes.get(body.phone) !== body.code) {
          const { AppException } = await import('@bus/shared');
          throw new AppException('OTP_INVALID');
        }
        return { verified: true, phone: body.phone };
      }
      if (name === 'tracking') return { ...body, online: true };
      return { ok: true };
    },
    get: async (path: string) => {
      calls.push({ method: 'GET', path: `${name}${path}` });
      return null;
    },
    patch: async () => ({}),
    put: async () => ({}),
    delete: async () => ({}),
  });

  let admin: any;
  let alice: any;
  let bob: any;
  let driverUser: any;
  let otherDriverUser: any;
  let trip: any;

  const authUser = (id: string) => services.auth.authUser(id);

  beforeAll(async () => {
    const { dataSourceOptions } = await import('../src/database/data-source');
    const setup = new DataSource({ ...(dataSourceOptions() as any), url: DB });
    await setup.initialize();
    await setup.dropDatabase();
    await setup.runMigrations();
    await setup.destroy();

    const { AppModule } = await import('../src/app.module');
    const { ClientsService } = await import('../src/common/clients.service');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ClientsService)
      .useValue({
        notification: fakeClient('notification'),
        sms: fakeClient('sms'),
        audit: fakeClient('audit'),
        tracking: fakeClient('tracking'),
        payment: fakeClient('payment'),
        scheduler: fakeClient('scheduler'),
        reporting: fakeClient('reporting'),
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    ds = app.get(DataSource);

    const { AuthService } = await import('../src/modules/auth/auth.service');
    const { TripsService } = await import('../src/modules/trips/trips.service');
    const { SeatLockService } = await import('../src/modules/trips/seat-lock.service');
    const { BookingsService } = await import('../src/modules/bookings/bookings.service');
    const { TripOpsService } = await import('../src/modules/bookings/trip-ops.service');
    const { TicketsService } = await import('../src/modules/tickets/tickets.service');
    const { TrackingService } = await import('../src/modules/tracking/tracking.module');
    const { BusesService } = await import('../src/modules/buses/buses.service');
    const { RoutesService } = await import('../src/modules/routes/routes.service');
    const { StopsService } = await import('../src/modules/stops/stops.module');
    const { DriversService } = await import('../src/modules/drivers/drivers.service');
    const { RedisService } = await import('../src/common/redis.service');
    services = {
      auth: app.get(AuthService),
      trips: app.get(TripsService),
      locks: app.get(SeatLockService),
      bookings: app.get(BookingsService),
      ops: app.get(TripOpsService),
      tickets: app.get(TicketsService),
      tracking: app.get(TrackingService),
      buses: app.get(BusesService),
      routes: app.get(RoutesService),
      stops: app.get(StopsService),
      drivers: app.get(DriversService),
      redis: app.get(RedisService),
    };
    await services.redis.client.flushdb();

    const perms = await ds.query(
      `INSERT INTO permissions (code) SELECT unnest($1::text[]) RETURNING id, code`,
      [[...PERMISSIONS]],
    );
    for (const role of Object.values(RoleName)) {
      const [r] = await ds.query(`INSERT INTO roles (name) VALUES ($1) RETURNING id`, [role]);
      const ids = perms.filter((p: any) => (ROLE_PERMISSIONS[role] as string[]).includes(p.code)).map((p: any) => p.id);
      for (const pid of ids) await ds.query(`INSERT INTO role_permissions ("roleId", "permissionId") VALUES ($1, $2)`, [r.id, pid]);
    }
    const mkUser = async (phone: string, role: RoleName) => {
      const [u] = await ds.query(
        `INSERT INTO users (phone, "fullName", "passwordHash") VALUES ($1, $2, $3) RETURNING id`,
        [phone, `User ${phone.slice(-2)}`, await argon2.hash('Secret123!')],
      );
      await ds.query(`INSERT INTO user_roles ("userId", "roleId") SELECT $1, id FROM roles WHERE name = $2`, [u.id, role]);
      return u.id as string;
    };
    admin = await authUser(await mkUser('998900000101', RoleName.ADMIN));
    alice = await authUser(await mkUser('998900000102', RoleName.PASSENGER));
    bob = await authUser(await mkUser('998900000103', RoleName.PASSENGER));

    const d1 = await services.drivers.create({ fullName: 'Driver One', phone: '+998900000104', password: 'Secret123!', licenseNumber: 'TT0000001' });
    const d2 = await services.drivers.create({ fullName: 'Driver Two', phone: '+998900000105', password: 'Secret123!', licenseNumber: 'TT0000002' });
    driverUser = await authUser(d1.userId);
    otherDriverUser = await authUser(d2.userId);

    const a = await services.stops.create({ name: 'A', city: 'Alpha', latitude: 41.3, longitude: 69.2 });
    const b = await services.stops.create({ name: 'B', city: 'Beta', latitude: 40.1, longitude: 67.8 });
    const c = await services.stops.create({ name: 'C', city: 'Gamma', latitude: 39.6, longitude: 66.9 });
    const route = await services.routes.create({
      name: 'Alpha — Gamma',
      code: 'A-G',
      stops: [
        { stopId: a.id, arrivalOffsetMin: 0, departureOffsetMin: 0 },
        { stopId: b.id, arrivalOffsetMin: 120, departureOffsetMin: 130 },
        { stopId: c.id, arrivalOffsetMin: 240, departureOffsetMin: 240 },
      ],
    });
    const bus = await services.buses.create({ name: 'Test Bus', model: 'T1', plateNumber: '01T001TT', layout: buildStandardLayout(4, 2, 2) });
    expect(bus.capacity).toBe(17);
    trip = await services.trips.create({
      routeId: route.id,
      busId: bus.id,
      driverId: d1.id,
      departureAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      price: 80000,
    });
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  const seats = async () => (await services.trips.seatMap(trip.id, null)).seats as any[];
  const passenger = (name: string) => ({ fullName: name, phone: '+998901112233' });

  it('creates trip seats from the bus layout and rejects overlapping bus usage', async () => {
    expect((await seats()).length).toBe(17);
    await expect(
      services.trips.create({ routeId: trip.routeId, busId: trip.busId, departureAt: trip.departureAt.toISOString(), price: 1000 }),
    ).rejects.toMatchObject({ code: 'BUS_BUSY' });
  });

  it('locks a seat in Redis and blocks other passengers', async () => {
    const seat = (await seats())[0];
    await services.locks.lock(trip.id, seat.id, alice.id);
    expect(await services.redis.client.get(`seat-lock:${trip.id}:${seat.id}`)).toBe(alice.id);
    await expect(services.locks.lock(trip.id, seat.id, bob.id)).rejects.toMatchObject({ code: 'SEAT_LOCKED_BY_OTHER' });
    await services.locks.unlock(trip.id, seat.id, alice.id);
    const after = (await seats()).find((s) => s.id === seat.id);
    expect(after.status).toBe(TripSeatStatus.AVAILABLE);
  });

  it('prevents double booking when two users race for the same seat', async () => {
    const seat = (await seats())[1];
    const attempt = (user: any, name: string) =>
      services.bookings.create({ tripId: trip.id, seats: [{ seatId: seat.id, passenger: passenger(name) }] }, user);
    const results = await Promise.allSettled([attempt(alice, 'Alice'), attempt(bob, 'Bob')]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(['SEAT_LOCKED_BY_OTHER', 'SEAT_NOT_AVAILABLE']).toContain(failed[0].reason.code);
    const active = await ds.query(`SELECT COUNT(*)::int AS n FROM booking_items WHERE "tripSeatId" = $1 AND active = true`, [seat.id]);
    expect(active[0].n).toBe(1);
  });

  it('enforces one active booking item per seat at the database level', async () => {
    const seat = (await seats()).find((s) => s.status === TripSeatStatus.RESERVED);
    const [item] = await ds.query(`SELECT * FROM booking_items WHERE "tripSeatId" = $1 AND active = true`, [seat.id]);
    await expect(
      ds.query(
        `INSERT INTO booking_items ("bookingId", "tripId", "tripSeatId", "passengerId", "seatNumber", price, active) VALUES ($1,$2,$3,$4,$5,$6,true)`,
        [item.bookingId, item.tripId, item.tripSeatId, item.passengerId, item.seatNumber, item.price],
      ),
    ).rejects.toMatchObject({ driverError: expect.objectContaining({ code: '23505' }) });
  });

  it('creates a pending booking with segment pricing and reserved seats', async () => {
    const [s1, s2] = (await seats()).filter((s) => s.status === TripSeatStatus.AVAILABLE);
    const stops = (await services.routes.get(trip.routeId)).stops;
    const booking = await services.bookings.create(
      {
        tripId: trip.id,
        fromStopId: stops[0].stopId,
        toStopId: stops[1].stopId,
        seats: [
          { seatId: s1.id, passenger: passenger('Seg One') },
          { seatId: s2.id, passenger: passenger('Seg Two') },
        ],
      },
      alice,
    );
    expect(booking.status).toBe(BookingStatus.PENDING);
    expect(booking.items).toHaveLength(2);
    expect(booking.totalAmount).toBeLessThan(2 * 80000);
    const reserved = (await seats()).filter((s) => [s1.id, s2.id].includes(s.id));
    expect(reserved.every((s) => s.status === TripSeatStatus.RESERVED)).toBe(true);
  });

  it('does not issue active tickets when payment fails', async () => {
    const [b] = (await services.bookings.list({ status: BookingStatus.PENDING }, alice.id)).items;
    await services.bookings.markPayment(b.id, '00000000-0000-0000-0000-0000000000f1', 'FAILED');
    const tickets = await ds.query(`SELECT * FROM tickets WHERE "bookingId" = $1`, [b.id]);
    expect(tickets).toHaveLength(0);
    const fresh = await services.bookings.get(b.id, alice);
    expect(fresh.status).toBe(BookingStatus.PENDING);
    expect(fresh.paymentStatus).toBe('FAILED');
  });

  it('confirms a booking on payment success, generates tickets and is idempotent', async () => {
    const [b] = (await services.bookings.list({ status: BookingStatus.PENDING }, alice.id)).items;
    const payId = '00000000-0000-0000-0000-0000000000a1';
    await services.bookings.confirmPaid(b.id, payId);
    await services.bookings.confirmPaid(b.id, payId);
    const booking = await services.bookings.get(b.id, alice);
    expect(booking.status).toBe(BookingStatus.CONFIRMED);
    expect(booking.tickets).toHaveLength(b.items.length);
    expect(booking.tickets.every((t: any) => t.status === TicketStatus.ACTIVE && t.qrToken)).toBe(true);
    const sold = (await seats()).filter((s) => b.items.some((i: any) => i.seatId === s.id));
    expect(sold.every((s) => s.status === TripSeatStatus.SOLD)).toBe(true);
  });

  it('verifies QR codes: valid once, then already used, tampered invalid, foreign driver rejected', async () => {
    const [b] = (await services.bookings.list({ status: BookingStatus.CONFIRMED }, alice.id)).items;
    const booking = await services.bookings.get(b.id, alice);
    const [t1, t2] = booking.tickets;
    expect((await services.tickets.verify(t1.qrToken, otherDriverUser, undefined)).result).toBe(VerificationResult.INVALID);
    expect((await services.tickets.verify(t1.qrToken, driverUser, trip.id)).result).toBe(VerificationResult.VALID);
    expect((await services.tickets.verify(t1.qrToken, driverUser, trip.id)).result).toBe(VerificationResult.ALREADY_USED);
    expect((await services.tickets.verify(t2.qrToken.slice(0, -3) + 'abc', driverUser, trip.id)).result).toBe(VerificationResult.INVALID);
    const parallel = await Promise.all([
      services.tickets.verify(t2.qrToken, admin, undefined),
      services.tickets.verify(t2.qrToken, admin, undefined),
    ]);
    expect(parallel.map((r: any) => r.result).sort()).toEqual([VerificationResult.ALREADY_USED, VerificationResult.VALID]);
  });

  it('refunds and releases seats when a paid booking is cancelled', async () => {
    const seat = (await seats()).find((s) => s.status === TripSeatStatus.AVAILABLE);
    const b = await services.bookings.create({ tripId: trip.id, seats: [{ seatId: seat.id, passenger: passenger('Cancel Me') }] }, bob);
    await services.bookings.confirmPaid(b.id, '00000000-0000-0000-0000-0000000000b1');
    calls.length = 0;
    const cancelled = await services.bookings.cancel(b.id, bob, 'CHANGED_PLANS');
    expect(cancelled.status).toBe(BookingStatus.CANCELLED);
    expect(calls.some((c) => c.path === 'payment/payments/00000000-0000-0000-0000-0000000000b1/refund')).toBe(true);
    expect((await seats()).find((s) => s.id === seat.id).status).toBe(TripSeatStatus.AVAILABLE);
    const tickets = await ds.query(`SELECT status FROM tickets WHERE "bookingId" = $1`, [b.id]);
    expect(tickets.every((t: any) => t.status === TicketStatus.CANCELLED)).toBe(true);
    await expect(services.bookings.cancel(b.id, bob, 'AGAIN')).rejects.toMatchObject({ code: 'BOOKING_INVALID_STATUS' });
  });

  it('expires unpaid bookings after the payment timeout', async () => {
    const seat = (await seats()).find((s) => s.status === TripSeatStatus.AVAILABLE);
    const b = await services.bookings.create({ tripId: trip.id, seats: [{ seatId: seat.id, passenger: passenger('Slow Payer') }] }, bob);
    await ds.query(`UPDATE bookings SET "expiresAt" = now() - interval '1 minute' WHERE id = $1`, [b.id]);
    const res = await services.bookings.expirePending();
    expect(res.expired).toBeGreaterThanOrEqual(1);
    expect((await services.bookings.get(b.id, bob)).status).toBe(BookingStatus.EXPIRED);
    expect((await seats()).find((s) => s.id === seat.id).status).toBe(TripSeatStatus.AVAILABLE);
  });

  it('releases expired seat locks', async () => {
    const seat = (await seats()).find((s) => s.status === TripSeatStatus.AVAILABLE);
    await services.locks.lock(trip.id, seat.id, bob.id);
    await ds.query(`UPDATE trip_seats SET "lockedUntil" = now() - interval '1 second' WHERE id = $1`, [seat.id]);
    await services.locks.releaseExpired();
    const row = await ds.query(`SELECT status FROM trip_seats WHERE id = $1`, [seat.id]);
    expect(row[0].status).toBe(TripSeatStatus.AVAILABLE);
  });

  it('only lets the assigned driver send tracking for an active trip', async () => {
    await expect(
      services.tracking.push({ tripId: trip.id, latitude: 41, longitude: 69 }, driverUser),
    ).rejects.toMatchObject({ code: 'TRACKING_NOT_ALLOWED' });
    await services.ops.start(trip.id, driverUser);
    await expect(
      services.tracking.push({ tripId: trip.id, latitude: 41, longitude: 69 }, otherDriverUser),
    ).rejects.toMatchObject({ code: 'DRIVER_NOT_ASSIGNED' });
    const loc = await services.tracking.push({ tripId: trip.id, latitude: 41, longitude: 69, speed: 70 }, driverUser);
    expect(loc.driverId).toBe(driverUser.driverId);
  });

  it('cancels a trip, its bookings, and blocks new bookings', async () => {
    const t2 = await services.trips.create({
      routeId: trip.routeId,
      busId: trip.busId,
      departureAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      price: 50000,
    });
    const seat = (await services.trips.seatMap(t2.id, null)).seats[0];
    const b = await services.bookings.create({ tripId: t2.id, seats: [{ seatId: seat.id, passenger: passenger('Trip Cancel') }] }, alice);
    const res = await services.ops.cancel(t2.id, 'BUS_BROKEN');
    expect(res.status).toBe(TripStatus.CANCELLED);
    expect((await services.bookings.get(b.id, alice)).status).toBe(BookingStatus.CANCELLED);
    const other = (await services.trips.seatMap(t2.id, null)).seats[1];
    await expect(
      services.bookings.create({ tripId: t2.id, seats: [{ seatId: other.id, passenger: passenger('Late') }] }, bob),
    ).rejects.toMatchObject({ code: 'TRIP_NOT_BOOKABLE' });
  });

  it('authenticates with password and OTP', async () => {
    await expect(services.auth.login({ login: '+998900000102', password: 'wrong' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    const ok = await services.auth.login({ login: '+998900000102', password: 'Secret123!' });
    expect(ok.accessToken).toBeTruthy();
    expect(ok.user.roles).toEqual([RoleName.PASSENGER]);
    const refreshed = await services.auth.refresh(ok.refreshToken);
    await expect(services.auth.refresh(ok.refreshToken)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    expect(refreshed.accessToken).toBeTruthy();

    await services.auth.phoneOrFail('+998 90 123 45 67');
    otpCodes.set('998901234567', '123456');
    await expect(services.auth.loginWithOtp({ phone: '+998901234567', code: '000000' })).rejects.toMatchObject({ code: 'OTP_INVALID' });
    const viaOtp = await services.auth.loginWithOtp({ phone: '+998901234567', code: '123456', fullName: 'New Passenger' });
    expect(viaOtp.created).toBe(true);
    expect(viaOtp.user.roles).toEqual([RoleName.PASSENGER]);
  });

  it('keeps inactive buses out of trip creation', async () => {
    const bus = await services.buses.create({ name: 'Old', model: 'X', plateNumber: '01X999XX', status: BusStatus.INACTIVE, layout: buildStandardLayout(2) });
    await expect(
      services.trips.create({ routeId: trip.routeId, busId: bus.id, departureAt: new Date(Date.now() + 9 * 86400000).toISOString(), price: 1000 }),
    ).rejects.toMatchObject({ code: 'BUS_INACTIVE' });
  });
});
