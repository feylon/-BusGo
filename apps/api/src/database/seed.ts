import 'reflect-metadata';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  BookingStatus,
  BusLayout,
  BusSeatStatus,
  BusStatus,
  LayoutCellKind,
  PERMISSIONS,
  ResponsibleEntity,
  ROLE_PERMISSIONS,
  RoleName,
  SeatType,
  TicketStatus,
  TripSeatStatus,
  TripStatus,
  buildStandardLayout,
  seatPosition,
} from '@bus/types';
import { EventBus, Events, BookingEventPayload, PaymentEventPayload, TripEventPayload } from '@bus/events';
import { haversineKm, randomCode } from '@bus/shared';
import { env } from '@bus/config';
import dataSource from './data-source';
import { Permission } from '../modules/users/permission.entity';
import { Role } from '../modules/users/role.entity';
import { User } from '../modules/users/user.entity';
import { Driver } from '../modules/drivers/driver.entity';
import { Passenger } from '../modules/passengers/passenger.entity';
import { Stop } from '../modules/stops/stop.entity';
import { Route } from '../modules/routes/route.entity';
import { RouteStop } from '../modules/routes/route-stop.entity';
import { Bus } from '../modules/buses/bus.entity';
import { BusSeat } from '../modules/buses/bus-seat.entity';
import { Trip } from '../modules/trips/trip.entity';
import { TripSeat } from '../modules/trips/trip-seat.entity';
import { PricingRule } from '../modules/pricing/pricing-rule.entity';
import { Booking } from '../modules/bookings/booking.entity';
import { BookingItem } from '../modules/bookings/booking-item.entity';
import { Ticket } from '../modules/tickets/ticket.entity';
import { Responsible } from '../modules/responsibles/responsible.entity';
import { Setting } from '../modules/settings/setting.entity';
import { DEFAULT_SETTINGS } from '../modules/settings/settings.service';
import { createQrToken } from '../modules/tickets/qr-token';

export const DEMO_ACCOUNTS = [
  { role: RoleName.SUPER_ADMIN, phone: '998900000001', email: 'superadmin@busline.uz', name: 'Super Admin', password: 'Admin123!' },
  { role: RoleName.ADMIN, phone: '998900000002', email: 'admin@busline.uz', name: 'Dilnoza Rahimova', password: 'Admin123!' },
  { role: RoleName.DISPATCHER, phone: '998900000003', email: 'dispatcher@busline.uz', name: 'Sardor Tursunov', password: 'Dispatch123!' },
];

const DRIVERS = [
  { phone: '998900000011', name: 'Akmal Yusupov', license: 'AA1234567', exp: 12 },
  { phone: '998900000012', name: 'Bobur Karimov', license: 'AB2345678', exp: 8 },
  { phone: '998900000013', name: 'Jasur Aliyev', license: 'AC3456789', exp: 15 },
  { phone: '998900000014', name: 'Rustam Nazarov', license: 'AD4567890', exp: 6 },
  { phone: '998900000015', name: 'Sherzod Qodirov', license: 'AE5678901', exp: 10 },
];

const PASSENGERS = [
  { phone: '998900000021', name: 'Aziza Saidova', doc: 'AB1234501' },
  { phone: '998900000022', name: 'Otabek Mirzayev', doc: 'AB1234502' },
  { phone: '998900000023', name: 'Malika Ergasheva', doc: 'AB1234503' },
  { phone: '998900000024', name: 'Ulugbek Hamidov', doc: 'AB1234504' },
];

const STOPS = [
  { key: 'TAS', name: 'Toshkent Markaziy Avtovokzal', city: 'Toshkent', region: 'Toshkent shahri', lat: 41.2919, lng: 69.2042 },
  { key: 'GUL', name: 'Guliston Avtostansiyasi', city: 'Guliston', region: 'Sirdaryo viloyati', lat: 40.4897, lng: 68.7842 },
  { key: 'JIZ', name: 'Jizzax Avtovokzali', city: 'Jizzax', region: 'Jizzax viloyati', lat: 40.1158, lng: 67.8422 },
  { key: 'SKD', name: 'Samarqand Avtovokzali', city: 'Samarqand', region: 'Samarqand viloyati', lat: 39.6542, lng: 66.9597 },
  { key: 'NAV', name: 'Navoiy Avtovokzali', city: 'Navoiy', region: 'Navoiy viloyati', lat: 40.1039, lng: 65.3739 },
  { key: 'BHK', name: 'Buxoro Avtovokzali', city: 'Buxoro', region: 'Buxoro viloyati', lat: 39.7747, lng: 64.4286 },
  { key: 'QRS', name: 'Qarshi Avtovokzali', city: 'Qarshi', region: 'Qashqadaryo viloyati', lat: 38.8606, lng: 65.7891 },
  { key: 'TRM', name: 'Termiz Avtovokzali', city: 'Termiz', region: 'Surxondaryo viloyati', lat: 37.2242, lng: 67.2783 },
  { key: 'QQN', name: "Qo'qon Avtovokzali", city: "Qo'qon", region: "Farg'ona viloyati", lat: 40.5286, lng: 70.9425 },
  { key: 'FRG', name: "Farg'ona Avtovokzali", city: "Farg'ona", region: "Farg'ona viloyati", lat: 40.3864, lng: 71.7864 },
  { key: 'NMG', name: 'Namangan Avtovokzali', city: 'Namangan', region: 'Namangan viloyati', lat: 40.9983, lng: 71.6726 },
  { key: 'AND', name: 'Andijon Avtovokzali', city: 'Andijon', region: 'Andijon viloyati', lat: 40.7821, lng: 72.3442 },
  { key: 'URG', name: 'Urganch Avtovokzali', city: 'Urganch', region: 'Xorazm viloyati', lat: 41.5506, lng: 60.6317 },
];

interface RouteSeed {
  code: string;
  name: string;
  stops: [string, number][];
  price: number;
  segments: [string, string, number][];
  times: string[];
}

const ROUTES: RouteSeed[] = [
  {
    code: 'TAS-SKD',
    name: 'Toshkent — Samarqand',
    stops: [['TAS', 0], ['GUL', 90], ['JIZ', 170], ['SKD', 270]],
    price: 80000,
    segments: [['TAS', 'SKD', 80000], ['TAS', 'JIZ', 45000], ['JIZ', 'SKD', 40000], ['TAS', 'GUL', 30000], ['GUL', 'SKD', 60000]],
    times: ['07:00', '10:30', '15:00', '19:30'],
  },
  {
    code: 'TAS-BHK',
    name: 'Toshkent — Buxoro',
    stops: [['TAS', 0], ['JIZ', 170], ['SKD', 270], ['NAV', 400], ['BHK', 480]],
    price: 140000,
    segments: [['TAS', 'BHK', 140000], ['TAS', 'SKD', 80000], ['SKD', 'BHK', 70000], ['TAS', 'NAV', 115000]],
    times: ['06:30', '21:00'],
  },
  {
    code: 'SKD-TRM',
    name: 'Samarqand — Termiz',
    stops: [['SKD', 0], ['QRS', 150], ['TRM', 380]],
    price: 110000,
    segments: [['SKD', 'TRM', 110000], ['SKD', 'QRS', 50000], ['QRS', 'TRM', 70000]],
    times: ['08:00', '16:00'],
  },
  {
    code: 'TAS-FRG',
    name: "Toshkent — Farg'ona",
    stops: [['TAS', 0], ['QQN', 240], ['FRG', 310]],
    price: 95000,
    segments: [['TAS', 'FRG', 95000], ['TAS', 'QQN', 75000]],
    times: ['08:30', '17:30'],
  },
  {
    code: 'TAS-AND',
    name: 'Toshkent — Andijon',
    stops: [['TAS', 0], ['NMG', 270], ['AND', 340]],
    price: 105000,
    segments: [['TAS', 'AND', 105000], ['TAS', 'NMG', 85000], ['NMG', 'AND', 25000]],
    times: ['09:00'],
  },
  {
    code: 'BHK-URG',
    name: 'Buxoro — Urganch',
    stops: [['BHK', 0], ['URG', 420]],
    price: 120000,
    segments: [['BHK', 'URG', 120000]],
    times: ['07:30'],
  },
];

const BUSES = [
  { name: 'Yutong Express 01', model: 'Yutong ZK6122H9', plate: '01A101BA', num: '101', rows: 12, left: 2, right: 2, vip: 0, amenities: ['WIFI', 'AC', 'USB'] },
  { name: 'Yutong Express 02', model: 'Yutong ZK6122H9', plate: '01A102BA', num: '102', rows: 12, left: 2, right: 2, vip: 0, amenities: ['WIFI', 'AC', 'USB'] },
  { name: 'Higer Comfort 03', model: 'Higer KLQ6128LQ', plate: '01A103BA', num: '103', rows: 11, left: 2, right: 2, vip: 2, amenities: ['AC', 'USB', 'TV'] },
  { name: 'Golden Dragon 04', model: 'Golden Dragon XML6127', plate: '30B204CA', num: '204', rows: 12, left: 2, right: 2, vip: 0, amenities: ['AC', 'WC'] },
  { name: 'Isuzu VIP 05', model: 'Isuzu Novo Lux', plate: '01A505VA', num: '505', rows: 9, left: 2, right: 1, vip: 9, amenities: ['WIFI', 'AC', 'USB', 'TV', 'WC'] },
  { name: 'MAN Lion 06', model: "MAN Lion's Coach", plate: '40C306DA', num: '306', rows: 13, left: 2, right: 2, vip: 0, amenities: ['WIFI', 'AC', 'USB', 'WC'] },
];

const RESPONSIBLES = [
  { name: 'Komil Ismoilov', phone: '998901110001', role: 'Hududiy menejer', region: 'Toshkent shahri', type: ResponsibleEntity.REGION },
  { name: 'Nodira Xasanova', phone: '998901110002', role: 'Hududiy menejer', region: 'Samarqand viloyati', type: ResponsibleEntity.REGION },
  { name: 'Farrux Jo‘rayev', phone: '998901110003', role: 'Texnik nazoratchi', region: 'Toshkent shahri', type: ResponsibleEntity.BUS },
  { name: 'Lola Abdullayeva', phone: '998901110004', role: 'Yo‘nalish rahbari', region: 'Buxoro viloyati', type: ResponsibleEntity.ROUTE },
];

const DAY = 86400000;

function tashkentDate(dayOffset: number, time: string) {
  const now = new Date(Date.now() + 5 * 3600000);
  const [h, m] = time.split(':').map(Number);
  const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, h - 5, m);
  return new Date(utc);
}

async function seedAccess(m: EntityManager) {
  const existing = await m.find(Permission);
  const missing = PERMISSIONS.filter((p) => !existing.some((e) => e.code === p));
  if (missing.length) await m.save(Permission, missing.map((code) => m.create(Permission, { code })));
  const perms = await m.find(Permission);
  for (const name of Object.values(RoleName)) {
    let role = await m.findOne(Role, { where: { name } });
    if (!role) role = m.create(Role, { name, description: name.replace('_', ' ').toLowerCase() });
    role.permissions = perms.filter((p) => (ROLE_PERMISSIONS[name] as string[]).includes(p.code));
    await m.save(Role, role);
  }
}

async function upsertUser(m: EntityManager, phone: string, fullName: string, password: string, role: RoleName, email?: string) {
  const found = await m.findOne(User, { where: { phone } });
  if (found) return found;
  const r = await m.findOneByOrFail(Role, { name: role });
  return m.save(User, m.create(User, { phone, fullName, email: email ?? null, passwordHash: await argon2.hash(password), roles: [r] }));
}

async function saveLayout(m: EntityManager, bus: Bus, layout: BusLayout) {
  const isAisle = (row: number) => (col: number) =>
    !layout.cells.some((c) => c.row === row && c.col === col && c.kind === LayoutCellKind.SEAT);
  const seats = layout.cells.filter((c) => c.kind === LayoutCellKind.SEAT);
  await m.delete(BusSeat, { busId: bus.id });
  await m.insert(
    BusSeat,
    seats.map((c) => ({
      busId: bus.id,
      number: c.number!,
      row: c.row,
      column: c.col,
      type: c.type ?? SeatType.STANDARD,
      status: c.status ?? BusSeatStatus.ACTIVE,
      position: seatPosition(c.col, layout.cols, isAisle(c.row)),
      metadata: {},
    })),
  );
  await m.update(Bus, bus.id, { layout, capacity: seats.filter((s) => s.status !== BusSeatStatus.DISABLED).length });
}

async function createTrip(m: EntityManager, route: Route, bus: Bus, driver: Driver | null, dep: Date, price: number, status = TripStatus.SCHEDULED) {
  const trip = await m.save(
    Trip,
    m.create(Trip, {
      routeId: route.id,
      busId: bus.id,
      driverId: driver?.id ?? null,
      departureAt: dep,
      arrivalAt: new Date(dep.getTime() + route.durationMin * 60000),
      price,
      status,
      startedAt: status === TripStatus.IN_PROGRESS || status === TripStatus.COMPLETED ? dep : null,
      completedAt: status === TripStatus.COMPLETED ? new Date(dep.getTime() + route.durationMin * 60000) : null,
    }),
  );
  const seats = await m.find(BusSeat, { where: { busId: bus.id } });
  await m.insert(
    TripSeat,
    seats
      .filter((s) => s.status !== BusSeatStatus.DISABLED)
      .map((s) => ({
        tripId: trip.id,
        busSeatId: s.id,
        number: s.number,
        row: s.row,
        column: s.column,
        type: s.type,
        status: s.status === BusSeatStatus.BLOCKED ? TripSeatStatus.BLOCKED : TripSeatStatus.AVAILABLE,
      })),
  );
  return trip;
}

interface Outbox {
  type: string;
  payload: unknown;
}

async function book(
  m: EntityManager,
  trip: Trip,
  route: Route,
  user: User,
  passengers: { name: string; phone: string; doc: string }[],
  outbox: Outbox[],
  opts: { used?: boolean; status?: BookingStatus } = {},
) {
  const free = await m.find(TripSeat, { where: { tripId: trip.id, status: TripSeatStatus.AVAILABLE }, order: { row: 'ASC', column: 'ASC' } });
  const take = free.slice(Math.floor(Math.random() * Math.max(1, free.length - passengers.length)), undefined).slice(0, passengers.length);
  if (take.length < passengers.length) return null;
  const stops = await m.find(RouteStop, { where: { routeId: route.id }, order: { order: 'ASC' } });
  const status = opts.status ?? (trip.status === TripStatus.COMPLETED ? BookingStatus.COMPLETED : BookingStatus.CONFIRMED);
  const confirmedAt = new Date(Math.min(Date.now(), trip.departureAt.getTime() - (2 + Math.random() * 72) * 3600000));
  const booking = await m.save(
    Booking,
    m.create(Booking, {
      code: randomCode(8),
      userId: user.id,
      tripId: trip.id,
      fromStopId: stops[0].stopId,
      toStopId: stops[stops.length - 1].stopId,
      status,
      totalAmount: trip.price * passengers.length,
      currency: 'UZS',
      paymentId: randomUUID(),
      paymentStatus: status === BookingStatus.CANCELLED ? 'REFUNDED' : 'SUCCEEDED',
      confirmedAt,
      cancelledAt: status === BookingStatus.CANCELLED ? new Date(confirmedAt.getTime() + 3600000) : null,
      cancelReason: status === BookingStatus.CANCELLED ? 'CANCELLED_BY_PASSENGER' : null,
      channel: Math.random() > 0.3 ? 'WEB' : 'MOBILE',
      createdAt: new Date(confirmedAt.getTime() - 5 * 60000),
    }),
  );
  const active = status !== BookingStatus.CANCELLED;
  for (let i = 0; i < passengers.length; i++) {
    const p = passengers[i];
    const seat = take[i];
    const passenger = await m.save(
      Passenger,
      m.create(Passenger, { userId: user.id, fullName: p.name, phone: p.phone, documentNumber: p.doc }),
    );
    const item = await m.save(
      BookingItem,
      m.create(BookingItem, {
        bookingId: booking.id,
        tripId: trip.id,
        tripSeatId: seat.id,
        passengerId: passenger.id,
        seatNumber: seat.number,
        price: trip.price,
        active,
      }),
    );
    if (active) await m.update(TripSeat, seat.id, { status: TripSeatStatus.SOLD, bookingId: booking.id });
    const ticketId = randomUUID();
    const ticketStatus = !active
      ? TicketStatus.CANCELLED
      : trip.status === TripStatus.COMPLETED
        ? TicketStatus.EXPIRED
        : opts.used
          ? TicketStatus.USED
          : TicketStatus.ACTIVE;
    await m.save(
      Ticket,
      m.create(Ticket, {
        id: ticketId,
        ticketNumber: `T${String(new Date().getFullYear()).slice(2)}${randomCode(8)}`,
        bookingId: booking.id,
        bookingItemId: item.id,
        passengerId: passenger.id,
        tripId: trip.id,
        seatId: seat.id,
        seatNumber: seat.number,
        qrToken: createQrToken(ticketId),
        status: ticketStatus,
        price: trip.price,
        issuedAt: confirmedAt,
        usedAt: ticketStatus === TicketStatus.USED ? new Date() : null,
      }),
    );
  }
  const payload: BookingEventPayload = {
    bookingId: booking.id,
    code: booking.code,
    userId: user.id,
    tripId: trip.id,
    routeId: route.id,
    routeName: route.name,
    busId: trip.busId,
    driverId: trip.driverId,
    departureAt: trip.departureAt.toISOString(),
    amount: booking.totalAmount,
    currency: 'UZS',
    seats: take.map((s) => s.number),
    seatCount: take.length,
    passengerIds: [],
    status: BookingStatus.CONFIRMED,
    recipient: { userId: user.id, phone: user.phone },
    occurredAt: confirmedAt.toISOString(),
    silent: true,
  };
  outbox.push({ type: Events.BookingConfirmed, payload });
  outbox.push({
    type: Events.PaymentSucceeded,
    payload: {
      paymentId: booking.paymentId!,
      bookingId: booking.id,
      userId: user.id,
      amount: booking.totalAmount,
      currency: 'UZS',
      status: 'SUCCEEDED',
      provider: 'mock',
      transactionId: `MOCK-${randomCode(10)}`,
      occurredAt: confirmedAt.toISOString(),
      routeId: route.id,
      silent: true,
    } satisfies PaymentEventPayload,
  });
  if (status === BookingStatus.CANCELLED) {
    outbox.push({
      type: Events.BookingCancelled,
      payload: { ...payload, status: BookingStatus.CANCELLED, reason: 'CANCELLED_BY_PASSENGER', occurredAt: booking.cancelledAt!.toISOString() },
    });
  }
  return booking;
}

const plates = new Map<string, string>();
const driverNames = new Map<string, string>();

function tripEvent(trip: Trip, route: Route, capacity: number, occurredAt: Date): TripEventPayload {
  return {
    tripId: trip.id,
    routeId: route.id,
    routeName: route.name,
    busId: trip.busId,
    driverId: trip.driverId,
    departureAt: trip.departureAt.toISOString(),
    arrivalAt: trip.arrivalAt.toISOString(),
    status: trip.status,
    capacity,
    busPlate: plates.get(trip.busId),
    driverName: trip.driverId ? driverNames.get(trip.driverId) : undefined,
    recipients: [],
    occurredAt: occurredAt.toISOString(),
    silent: true,
  };
}

async function ensureUpcomingTrips(ds: DataSource, outbox: Outbox[], days: number) {
  const routes = await ds.getRepository(Route).find();
  const buses = await ds.getRepository(Bus).find({ where: { status: BusStatus.ACTIVE }, order: { plateNumber: 'ASC' } });
  const drivers = await ds.getRepository(Driver).find({ order: { licenseNumber: 'ASC' } });
  let created = 0;
  let slot = 0;
  for (let day = 0; day <= days; day++) {
    for (const seed of ROUTES) {
      const route = routes.find((r) => r.code === seed.code);
      if (!route) continue;
      for (const time of seed.times) {
        slot++;
        const dep = tashkentDate(day, time);
        if (dep.getTime() < Date.now() + 30 * 60000) continue;
        const exists = await ds.getRepository(Trip).exist({ where: { routeId: route.id, departureAt: dep } });
        if (exists) continue;
        const bus = buses[slot % buses.length];
        const driver = drivers[slot % drivers.length];
        const overlap = async (col: 'busId' | 'driverId', id: string) =>
          ds
            .getRepository(Trip)
            .createQueryBuilder('t')
            .where(`t.${col} = :id`, { id })
            .andWhere("t.status NOT IN ('CANCELLED','COMPLETED')")
            .andWhere('t.departureAt < :arr AND t.arrivalAt > :dep', { arr: new Date(dep.getTime() + route.durationMin * 60000), dep })
            .getExists();
        const freeBus = (await overlap('busId', bus.id))
          ? (await Promise.all(buses.map(async (b) => ((await overlap('busId', b.id)) ? null : b)))).find(Boolean)
          : bus;
        if (!freeBus) continue;
        const freeDriver = (await overlap('driverId', driver.id))
          ? (await Promise.all(drivers.map(async (d) => ((await overlap('driverId', d.id)) ? null : d)))).find(Boolean) ?? null
          : driver;
        const trip = await ds.transaction((m) => createTrip(m, route, freeBus, freeDriver, dep, seed.price));
        outbox.push({ type: Events.TripCreated, payload: tripEvent(trip, route, freeBus.capacity, new Date()) });
        created++;
      }
    }
  }
  return created;
}

async function seedAll(ds: DataSource, outbox: Outbox[]) {
  await ds.transaction(seedAccess);
  const m = ds.manager;

  for (const a of DEMO_ACCOUNTS) await upsertUser(m, a.phone, a.name, a.password, a.role, a.email);
  const driverUsers: Driver[] = [];
  for (const d of DRIVERS) {
    const user = await upsertUser(m, d.phone, d.name, 'Driver123!', RoleName.DRIVER);
    let driver = await m.findOne(Driver, { where: { userId: user.id } });
    if (!driver) driver = await m.save(Driver, m.create(Driver, { userId: user.id, licenseNumber: d.license, licenseCategory: 'D', experienceYears: d.exp }));
    driverUsers.push(driver);
  }
  const passengerUsers: User[] = [];
  for (const p of PASSENGERS) passengerUsers.push(await upsertUser(m, p.phone, p.name, 'Passenger123!', RoleName.PASSENGER));

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(await m.exists(Setting, { where: { key } }))) await m.save(Setting, { key, value });
  }

  if (await m.exists(Route)) return false;

  const stops = new Map<string, Stop>();
  for (const s of STOPS) {
    stops.set(s.key, await m.save(Stop, m.create(Stop, { name: s.name, city: s.city, region: s.region, latitude: s.lat, longitude: s.lng })));
  }

  const routes: { seed: RouteSeed; route: Route }[] = [];
  for (const r of ROUTES) {
    let dist = 0;
    const routeStops = r.stops.map(([key, offset], i) => {
      if (i > 0) {
        const a = stops.get(r.stops[i - 1][0])!;
        const b = stops.get(key)!;
        dist += haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1.25;
      }
      const isLast = i === r.stops.length - 1;
      return { stopId: stops.get(key)!.id, order: i + 1, arrivalOffsetMin: offset, departureOffsetMin: i === 0 || isLast ? offset : offset + 10, distanceFromStartKm: Math.round(dist) };
    });
    const last = routeStops[routeStops.length - 1];
    const route = await m.save(
      Route,
      m.create(Route, {
        name: r.name,
        code: r.code,
        originId: routeStops[0].stopId,
        destinationId: last.stopId,
        distanceKm: last.distanceFromStartKm,
        durationMin: last.arrivalOffsetMin,
      }),
    );
    await m.insert(RouteStop, routeStops.map((s) => ({ ...s, routeId: route.id })));
    for (const [from, to, price] of r.segments) {
      await m.save(PricingRule, m.create(PricingRule, { routeId: route.id, fromStopId: stops.get(from)!.id, toStopId: stops.get(to)!.id, price, seatType: null }));
      await m.save(
        PricingRule,
        m.create(PricingRule, { routeId: route.id, fromStopId: stops.get(from)!.id, toStopId: stops.get(to)!.id, price: Math.round((price * 1.5) / 1000) * 1000, seatType: SeatType.VIP }),
      );
    }
    routes.push({ seed: r, route });
  }

  const buses: Bus[] = [];
  for (const b of BUSES) {
    const bus = await m.save(
      Bus,
      m.create(Bus, { name: b.name, model: b.model, plateNumber: b.plate, busNumber: b.num, amenities: b.amenities, status: BusStatus.ACTIVE }),
    );
    const layout = buildStandardLayout(b.rows, b.left, b.right, { vipRows: b.vip });
    if (b.num === '103') {
      const cell = layout.cells.find((c) => c.number === '04');
      if (cell) cell.status = BusSeatStatus.BLOCKED;
    }
    await saveLayout(m, bus, layout);
    buses.push((await m.findOneByOrFail(Bus, { id: bus.id }))!);
  }
  const maintenance = await m.save(
    Bus,
    m.create(Bus, { name: 'Yutong Reserve 07', model: 'Yutong ZK6938', plateNumber: '01A707AA', busNumber: '707', amenities: ['AC'], status: BusStatus.MAINTENANCE }),
  );
  await saveLayout(m, maintenance, buildStandardLayout(9, 2, 2));
  await loadNames(ds);

  for (const r of RESPONSIBLES) {
    const entityId = r.type === ResponsibleEntity.BUS ? buses[0].id : r.type === ResponsibleEntity.ROUTE ? routes[1].route.id : null;
    await m.save(Responsible, m.create(Responsible, { name: r.name, phone: r.phone, role: r.role, region: r.region, entityType: r.type, entityId }));
  }

  const people = (n: number, offset = 0) =>
    Array.from({ length: n }, (_, i) => {
      const p = PASSENGERS[(i + offset) % PASSENGERS.length];
      return { name: i === 0 ? p.name : `${['Kamola', 'Javohir', 'Nilufar', 'Sanjar', 'Gulnora', 'Timur'][(i + offset) % 6]} ${p.name.split(' ')[1]}`, phone: p.phone, doc: `${p.doc.slice(0, 7)}${i}${offset % 10}` };
    });

  for (let day = 30; day >= 1; day--) {
    for (let k = 0; k < routes.length; k++) {
      if ((day + k) % 3 === 0) continue;
      const { seed, route } = routes[k];
      const bus = buses[(day + k) % buses.length];
      const driver = driverUsers[(day + k) % driverUsers.length];
      const dep = tashkentDate(-day, seed.times[0]);
      const trip = await ds.transaction((tm) => createTrip(tm, route, bus, driver, dep, seed.price, TripStatus.COMPLETED));
      outbox.push({ type: Events.TripCreated, payload: tripEvent(trip, route, bus.capacity, new Date(dep.getTime() - 7 * DAY)) });
      const count = 3 + ((day * 7 + k * 3) % 9);
      for (let i = 0; i < count; i++) {
        const user = passengerUsers[(i + day) % passengerUsers.length];
        const cancelled = (i + day + k) % 11 === 0;
        await ds.transaction((tm) =>
          book(tm, trip, route, user, people(1 + ((i + k) % 3), i + day), outbox, { status: cancelled ? BookingStatus.CANCELLED : undefined }),
        );
      }
      outbox.push({ type: Events.TripCompleted, payload: tripEvent(trip, route, bus.capacity, trip.arrivalAt) });
    }
  }

  const tasSkd = routes[0];
  const live = await ds.transaction((tm) =>
    createTrip(tm, tasSkd.route, buses[0], driverUsers[0], new Date(Date.now() - 50 * 60000), tasSkd.seed.price, TripStatus.IN_PROGRESS),
  );
  outbox.push({ type: Events.TripCreated, payload: tripEvent(live, tasSkd.route, buses[0].capacity, new Date(Date.now() - 2 * DAY)) });
  for (let i = 0; i < 6; i++) {
    await ds.transaction((tm) => book(tm, live, tasSkd.route, passengerUsers[i % passengerUsers.length], people(1 + (i % 2), i), outbox, { used: true }));
  }

  const boarding = await ds.transaction((tm) =>
    createTrip(tm, routes[3].route, buses[3], driverUsers[1], new Date(Date.now() + 25 * 60000), routes[3].seed.price, TripStatus.BOARDING),
  );
  outbox.push({ type: Events.TripCreated, payload: tripEvent(boarding, routes[3].route, buses[3].capacity, new Date(Date.now() - DAY)) });
  for (let i = 0; i < 4; i++) {
    await ds.transaction((tm) => book(tm, boarding, routes[3].route, passengerUsers[i % passengerUsers.length], people(1, i + 3), outbox));
  }
  return true;
}

async function seedUpcomingBookings(ds: DataSource, outbox: Outbox[]) {
  const passengerUsers = await ds.getRepository(User).find({ where: { phone: In(PASSENGERS.map((p) => p.phone)) } });
  const trips = await ds.getRepository(Trip).find({
    where: { status: TripStatus.SCHEDULED },
    relations: { route: true },
    order: { departureAt: 'ASC' },
    take: 24,
  });
  for (let t = 0; t < trips.length; t++) {
    const trip = trips[t];
    for (let i = 0; i < (t % 4) + 2; i++) {
      const user = passengerUsers[(t + i) % passengerUsers.length];
      await ds.transaction((m) =>
        book(m, trip, trip.route!, user, [{ name: user.fullName, phone: user.phone, doc: `AC${String(1000000 + t * 10 + i)}` }], outbox),
      );
    }
  }
}

async function publish(outbox: Outbox[]) {
  if (!outbox.length || process.env.SEED_EVENTS === 'false') return;
  const bus = new EventBus({ url: env('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'), service: 'seed' });
  try {
    await Promise.race([bus.connect(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))]);
    for (const e of outbox) await bus.publish(e.type, e.payload);
    console.log(`Published ${outbox.length} seed events`);
  } catch (err) {
    console.warn(`Seed events were not published: ${(err as Error).message}`);
  } finally {
    await bus.close();
  }
}

async function loadNames(ds: DataSource) {
  for (const b of await ds.getRepository(Bus).find()) plates.set(b.id, b.plateNumber);
  for (const d of await ds.getRepository(Driver).find()) driverNames.set(d.id, d.user.fullName);
}

async function run() {
  await dataSource.initialize();
  const outbox: Outbox[] = [];
  const fresh = await seedAll(dataSource, outbox);
  await loadNames(dataSource);
  const created = await ensureUpcomingTrips(dataSource, outbox, Number(process.env.SEED_DAYS ?? 7));
  if (fresh) await seedUpcomingBookings(dataSource, outbox);
  console.log(fresh ? 'Seed: demo data created' : 'Seed: base data already present');
  console.log(`Seed: ${created} upcoming trips created`);
  await dataSource.destroy();
  await publish(outbox);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
