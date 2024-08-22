import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  BOOKABLE_TRIP_STATUSES,
  BookingStatus,
  BusSeatStatus,
  BusStatus,
  LayoutCellKind,
  SeatType,
  TripSeatStatus,
  TripStatus,
} from '@bus/types';
import { Events, Recipient, TripEventPayload } from '@bus/events';
import { AppException, paginate } from '@bus/shared';
import { Trip } from './trip.entity';
import { TripSeat } from './trip-seat.entity';
import { Route } from '../routes/route.entity';
import { Bus } from '../buses/bus.entity';
import { BusSeat } from '../buses/bus-seat.entity';
import { Driver, DriverStatus } from '../drivers/driver.entity';
import { Booking } from '../bookings/booking.entity';
import { PricingService, Segment } from '../pricing/pricing.service';
import { SettingsService } from '../settings/settings.service';
import { EventsService } from '../../common/events.service';
import { RedisService } from '../../common/redis.service';
import { pageResult } from '../../common/dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateTripDto, GenerateTripsDto, TripQuery, TripSearchQuery, UpdateTripDto } from './trips.dto';

const BUSY_STATUSES = [TripStatus.SCHEDULED, TripStatus.BOARDING, TripStatus.IN_PROGRESS, TripStatus.DELAYED];
const TZ = 'Asia/Tashkent';

export function tripCacheKey(id: string) {
  return `trip-info:${id}`;
}

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
    @InjectRepository(TripSeat) private readonly seats: Repository<TripSeat>,
    @InjectRepository(Route) private readonly routes: Repository<Route>,
    @InjectRepository(Bus) private readonly buses: Repository<Bus>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    private readonly pricing: PricingService,
    private readonly settings: SettingsService,
    private readonly events: EventsService,
    private readonly redis: RedisService,
    private readonly realtime: RealtimeGateway,
    private readonly ds: DataSource,
  ) {}

  async list(q: TripQuery) {
    const { page, limit, skip } = paginate(q);
    const qb = this.trips
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.route', 'r')
      .leftJoinAndSelect('t.bus', 'b')
      .leftJoinAndSelect('t.driver', 'd')
      .leftJoinAndSelect('d.user', 'du')
      .orderBy('t.departureAt', 'ASC')
      .skip(skip)
      .take(limit);
    if (q.routeId) qb.andWhere('t.routeId = :routeId', { routeId: q.routeId });
    if (q.busId) qb.andWhere('t.busId = :busId', { busId: q.busId });
    if (q.driverId) qb.andWhere('t.driverId = :driverId', { driverId: q.driverId });
    if (q.status) qb.andWhere('t.status = :status', { status: q.status });
    if (q.date) qb.andWhere(`(t.departureAt AT TIME ZONE '${TZ}')::date = :day`, { day: q.date });
    if (q.from) qb.andWhere(`(t.departureAt AT TIME ZONE '${TZ}')::date >= :from`, { from: q.from });
    if (q.to) qb.andWhere(`(t.departureAt AT TIME ZONE '${TZ}')::date <= :to`, { to: q.to });
    if (q.search) qb.andWhere('(r.name ILIKE :s OR b.plateNumber ILIKE :s OR du.fullName ILIKE :s)', { s: `%${q.search}%` });
    const [items, total] = await qb.getManyAndCount();
    const stats = await this.seatStats(items.map((t) => t.id));
    return pageResult(
      items.map((t) => ({ ...t, seats: stats.get(t.id) ?? { total: 0, available: 0, sold: 0, reserved: 0 } })),
      total,
      page,
      limit,
    );
  }

  async seatStats(ids: string[]) {
    const map = new Map<string, { total: number; available: number; sold: number; reserved: number }>();
    if (!ids.length) return map;
    const rows = await this.seats
      .createQueryBuilder('s')
      .select('s.tripId', 'tripId')
      .addSelect('COUNT(*) FILTER (WHERE s.status <> :blocked)::int', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE s.status = :available OR (s.status = :locked AND s."lockedUntil" < now()))::int`,
        'available',
      )
      .addSelect('COUNT(*) FILTER (WHERE s.status = :sold)::int', 'sold')
      .addSelect('COUNT(*) FILTER (WHERE s.status = :reserved)::int', 'reserved')
      .where('s.tripId IN (:...ids)', { ids })
      .setParameters({
        blocked: TripSeatStatus.BLOCKED,
        available: TripSeatStatus.AVAILABLE,
        locked: TripSeatStatus.LOCKED,
        sold: TripSeatStatus.SOLD,
        reserved: TripSeatStatus.RESERVED,
      })
      .groupBy('s.tripId')
      .getRawMany();
    for (const r of rows) map.set(r.tripId, { total: r.total, available: r.available, sold: r.sold, reserved: r.reserved });
    return map;
  }

  async search(q: TripSearchQuery) {
    const closeMin = await this.settings.num('booking.salesCloseBeforeDepartureMin');
    const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
    const qb = this.trips
      .createQueryBuilder('t')
      .innerJoin('route_stops', 'rf', 'rf."routeId" = t."routeId"')
      .innerJoin('stops', 'sf', 'sf.id = rf."stopId"')
      .innerJoin('route_stops', 'rt', 'rt."routeId" = t."routeId" AND rt."order" > rf."order"')
      .innerJoin('stops', 'st', 'st.id = rt."stopId"')
      .select(['t.id AS "tripId"', 'rf."stopId" AS "fromStopId"', 'rt."stopId" AS "toStopId"'])
      .where('t.status IN (:...statuses)', { statuses: BOOKABLE_TRIP_STATUSES })
      .andWhere(isUuid(q.from) ? 'sf.id = :from' : 'sf.city ILIKE :from', { from: q.from.trim() })
      .andWhere(isUuid(q.to) ? 'st.id = :to' : 'st.city ILIKE :to', { to: q.to.trim() })
      .andWhere(`t."departureAt" + make_interval(mins => rf."departureOffsetMin") > now() + make_interval(mins => :close)`, {
        close: closeMin,
      })
      .orderBy('t."departureAt"', 'ASC')
      .addOrderBy('rf."order"', 'ASC')
      .addOrderBy('rt."order"', 'DESC')
      .limit(200);
    if (q.date)
      qb.andWhere(
        `((t."departureAt" + make_interval(mins => rf."departureOffsetMin")) AT TIME ZONE '${TZ}')::date = :day`,
        { day: q.date },
      );
    const rows: { tripId: string; fromStopId: string; toStopId: string }[] = await qb.getRawMany();
    const seen = new Set<string>();
    const pairs = rows.filter((r) => (seen.has(r.tripId) ? false : (seen.add(r.tripId), true)));
    if (!pairs.length) return [];
    const trips = await this.trips.find({
      where: { id: In(pairs.map((p) => p.tripId)) },
      relations: { route: { stops: { stop: true } }, bus: true },
    });
    const stats = await this.seatStats(trips.map((t) => t.id));
    const result = [];
    for (const p of pairs) {
      const trip = trips.find((t) => t.id === p.tripId)!;
      const seg = await this.pricing.segment(trip.routeId, p.fromStopId, p.toStopId);
      const { price } = await this.pricing.quote({
        routeId: trip.routeId,
        basePrice: trip.price,
        seg,
        seatType: SeatType.STANDARD,
        at: trip.departureAt,
      });
      const available = stats.get(trip.id)?.available ?? 0;
      if (q.passengers && available < q.passengers) continue;
      result.push({ ...this.summary(trip, seg), price, availableSeats: available, totalSeats: stats.get(trip.id)?.total ?? 0 });
    }
    return result;
  }

  summary(trip: Trip, seg: Segment) {
    const dep = new Date(trip.departureAt.getTime() + seg.from.departureOffsetMin * 60000 + trip.delayMinutes * 60000);
    const arr = new Date(trip.departureAt.getTime() + seg.to.arrivalOffsetMin * 60000 + trip.delayMinutes * 60000);
    return {
      id: trip.id,
      status: trip.status,
      delayMinutes: trip.delayMinutes,
      currency: trip.currency,
      route: { id: trip.route?.id, name: trip.route?.name, code: trip.route?.code },
      bus: trip.bus
        ? { id: trip.bus.id, name: trip.bus.name, model: trip.bus.model, plateNumber: trip.bus.plateNumber, amenities: trip.bus.amenities }
        : null,
      from: { id: seg.from.stopId, name: seg.from.stop?.name, city: seg.from.stop?.city },
      to: { id: seg.to.stopId, name: seg.to.stop?.name, city: seg.to.stop?.city },
      departureAt: dep,
      arrivalAt: arr,
      durationMin: Math.round((arr.getTime() - dep.getTime()) / 60000),
      distanceKm: Math.round(seg.to.distanceFromStartKm - seg.from.distanceFromStartKm),
    };
  }

  async get(id: string) {
    const trip = await this.trips.findOne({
      where: { id },
      relations: { route: { stops: { stop: true }, origin: true, destination: true }, bus: true, driver: true },
    });
    if (!trip) throw new AppException('TRIP_NOT_FOUND', HttpStatus.NOT_FOUND);
    trip.route?.stops?.sort((a, b) => a.order - b.order);
    return trip;
  }

  async details(id: string) {
    const trip = await this.get(id);
    const stats = (await this.seatStats([id])).get(id);
    const driver = trip.driver
      ? { id: trip.driver.id, fullName: trip.driver.user?.fullName, phone: trip.driver.user?.phone }
      : null;
    return { ...trip, driver, seats: stats };
  }

  async seatMap(id: string, userId: string | null, fromStopId?: string, toStopId?: string) {
    const trip = await this.get(id);
    const seg = await this.pricing.segment(trip.routeId, fromStopId, toStopId);
    const seats = await this.seats.find({ where: { tripId: id }, order: { row: 'ASC', column: 'ASC' } });
    const prices = new Map<SeatType, number>();
    for (const type of new Set(seats.map((s) => s.type))) {
      prices.set(type, (await this.pricing.quote({ routeId: trip.routeId, basePrice: trip.price, seg, seatType: type, at: trip.departureAt })).price);
    }
    const now = Date.now();
    const layout = trip.bus?.layout ?? { rows: 0, cols: 0, cells: [] };
    const rows = Math.max(layout.rows, ...seats.map((s) => s.row + 1));
    const cols = Math.max(layout.cols, ...seats.map((s) => s.column + 1));
    const fixtures = layout.cells.filter((c) => c.kind !== LayoutCellKind.SEAT && !seats.some((s) => s.row === c.row && s.column === c.col));
    return {
      trip: this.summary(trip, seg),
      layout: { rows, cols, fixtures },
      seats: seats.map((s) => {
        const expired = s.status === TripSeatStatus.LOCKED && (!s.lockedUntil || s.lockedUntil.getTime() < now);
        const status = expired ? TripSeatStatus.AVAILABLE : s.status;
        return {
          id: s.id,
          number: s.number,
          row: s.row,
          column: s.column,
          type: s.type,
          status,
          lockedByMe: !expired && status === TripSeatStatus.LOCKED && !!userId && s.lockedBy === userId,
          lockedUntil: !expired && status === TripSeatStatus.LOCKED ? s.lockedUntil : null,
          price: prices.get(s.type) ?? trip.price,
        };
      }),
    };
  }

  private async validateResources(busId: string, driverId: string | null | undefined, dep: Date, arr: Date, excludeId?: string) {
    const bus = await this.buses.findOne({ where: { id: busId } });
    if (!bus) throw new AppException('BUS_NOT_FOUND', HttpStatus.NOT_FOUND);
    if (bus.status !== BusStatus.ACTIVE) throw new AppException('BUS_INACTIVE', HttpStatus.CONFLICT);
    const overlap = (col: 'busId' | 'driverId', value: string) => {
      const qb = this.trips
        .createQueryBuilder('t')
        .where(`t.${col} = :value`, { value })
        .andWhere('t.status IN (:...st)', { st: BUSY_STATUSES })
        .andWhere('t.departureAt < :arr AND t.arrivalAt > :dep', { arr, dep });
      if (excludeId) qb.andWhere('t.id <> :excludeId', { excludeId });
      return qb.getExists();
    };
    if (await overlap('busId', busId)) throw new AppException('BUS_BUSY', HttpStatus.CONFLICT);
    if (driverId) {
      const driver = await this.drivers.findOne({ where: { id: driverId } });
      if (!driver || driver.status !== DriverStatus.ACTIVE) throw new AppException('DRIVER_NOT_FOUND', HttpStatus.NOT_FOUND);
      if (await overlap('driverId', driverId)) throw new AppException('DRIVER_BUSY', HttpStatus.CONFLICT);
    }
    return bus;
  }

  async create(dto: CreateTripDto, correlationId?: string) {
    const route = await this.routes.findOne({ where: { id: dto.routeId } });
    if (!route || !route.active) throw new AppException('ROUTE_NOT_FOUND', HttpStatus.NOT_FOUND);
    const dep = new Date(dto.departureAt);
    const arr = dto.arrivalAt ? new Date(dto.arrivalAt) : new Date(dep.getTime() + route.durationMin * 60000);
    if (arr <= dep) throw new AppException('VALIDATION_ERROR', HttpStatus.BAD_REQUEST, ['arrivalAt must be after departureAt']);
    const bus = await this.validateResources(dto.busId, dto.driverId, dep, arr);
    const trip = await this.ds.transaction(async (m) => {
      const busSeats = await m.find(BusSeat, { where: { busId: bus.id } });
      if (!busSeats.filter((s) => s.status !== BusSeatStatus.DISABLED).length)
        throw new AppException('BUS_HAS_NO_SEATS', HttpStatus.CONFLICT);
      const saved = await m.save(
        m.create(Trip, {
          routeId: route.id,
          busId: bus.id,
          driverId: dto.driverId ?? null,
          departureAt: dep,
          arrivalAt: arr,
          price: dto.price,
          status: TripStatus.SCHEDULED,
        }),
      );
      await m.insert(
        TripSeat,
        busSeats
          .filter((s) => s.status !== BusSeatStatus.DISABLED)
          .map((s) => ({
            tripId: saved.id,
            busSeatId: s.id,
            number: s.number,
            row: s.row,
            column: s.column,
            type: s.type,
            status: s.status === BusSeatStatus.BLOCKED ? TripSeatStatus.BLOCKED : TripSeatStatus.AVAILABLE,
          })),
      );
      return saved;
    });
    const full = await this.get(trip.id);
    await this.emitTrip(Events.TripCreated, full, [], undefined, correlationId);
    return full;
  }

  async generate(dto: GenerateTripsDto, correlationId?: string) {
    const created: Trip[] = [];
    const skipped: { date: string; reason: string }[] = [];
    for (let i = 0; i < dto.days; i++) {
      const dep = new Date(new Date(dto.departureAt).getTime() + i * 86400000);
      try {
        created.push(
          await this.create(
            { ...dto, departureAt: dep.toISOString(), arrivalAt: dto.arrivalAt ? new Date(new Date(dto.arrivalAt).getTime() + i * 86400000).toISOString() : undefined },
            correlationId,
          ),
        );
      } catch (err) {
        skipped.push({ date: dep.toISOString(), reason: (err as AppException).code ?? (err as Error).message });
      }
    }
    return { created: created.length, skipped, trips: created.map((t) => ({ id: t.id, departureAt: t.departureAt })) };
  }

  async update(id: string, dto: UpdateTripDto) {
    const trip = await this.get(id);
    if (![TripStatus.SCHEDULED, TripStatus.DELAYED, TripStatus.BOARDING].includes(trip.status))
      throw new AppException('TRIP_INVALID_STATUS', HttpStatus.CONFLICT);
    const dep = dto.departureAt ? new Date(dto.departureAt) : trip.departureAt;
    const arr = dto.arrivalAt
      ? new Date(dto.arrivalAt)
      : dto.departureAt
        ? new Date(dep.getTime() + (trip.arrivalAt.getTime() - trip.departureAt.getTime()))
        : trip.arrivalAt;
    const busId = dto.busId ?? trip.busId;
    const driverId = dto.driverId !== undefined ? dto.driverId : trip.driverId;
    await this.validateResources(busId, driverId, dep, arr, id);
    if (busId !== trip.busId) {
      const hasBookings = await this.bookings.exist({
        where: { tripId: id, status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]) },
      });
      if (hasBookings) throw new AppException('TRIP_INVALID_STATUS', HttpStatus.CONFLICT, { reason: 'HAS_BOOKINGS' });
      await this.ds.transaction(async (m) => {
        const busSeats = await m.find(BusSeat, { where: { busId } });
        await m.delete(TripSeat, { tripId: id });
        await m.insert(
          TripSeat,
          busSeats
            .filter((s) => s.status !== BusSeatStatus.DISABLED)
            .map((s) => ({
              tripId: id,
              busSeatId: s.id,
              number: s.number,
              row: s.row,
              column: s.column,
              type: s.type,
              status: s.status === BusSeatStatus.BLOCKED ? TripSeatStatus.BLOCKED : TripSeatStatus.AVAILABLE,
            })),
        );
      });
    }
    await this.trips.update(id, {
      busId,
      driverId,
      departureAt: dep,
      arrivalAt: arr,
      ...(dto.price !== undefined ? { price: dto.price } : {}),
    });
    await this.redis.client.del(tripCacheKey(id));
    const updated = await this.get(id);
    this.realtime.toTrip(id, 'trip.updated', { id, status: updated.status, departureAt: updated.departureAt });
    return updated;
  }

  async assignDriver(id: string, driverId: string) {
    return this.update(id, { driverId });
  }

  async recipients(tripId: string): Promise<Recipient[]> {
    const rows = await this.bookings
      .createQueryBuilder('b')
      .innerJoin('b.user', 'u')
      .select(['u.id AS "userId"', 'u.phone AS phone', 'u.lang AS lang'])
      .where('b.tripId = :tripId AND b.status IN (:...st)', {
        tripId,
        st: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
      })
      .distinct(true)
      .getRawMany();
    return rows;
  }

  async emitTrip(type: string, trip: Trip, recipients: Recipient[], extra: Partial<TripEventPayload> = {}, correlationId?: string) {
    const capacity = await this.seats.count({ where: { tripId: trip.id } });
    await this.events.emit<TripEventPayload>(
      type,
      {
        tripId: trip.id,
        routeId: trip.routeId,
        routeName: trip.route?.name ?? '',
        busId: trip.busId,
        driverId: trip.driverId,
        departureAt: trip.departureAt.toISOString(),
        arrivalAt: trip.arrivalAt.toISOString(),
        status: trip.status,
        capacity,
        busPlate: trip.bus?.plateNumber,
        driverName: trip.driver?.user?.fullName,
        delayMinutes: trip.delayMinutes,
        recipients,
        ...extra,
      },
      correlationId,
    );
  }

  async setStatus(id: string, status: TripStatus, patch: Partial<Trip> = {}) {
    await this.trips.update(id, { status, ...patch });
    await this.redis.client.del(tripCacheKey(id));
    const trip = await this.get(id);
    this.realtime.toTrip(id, 'trip.updated', {
      id,
      status: trip.status,
      delayMinutes: trip.delayMinutes,
      departureAt: trip.departureAt,
    });
    this.realtime.toTracking('trip.updated', { id, status: trip.status });
    return trip;
  }

  async cachedInfo(id: string) {
    const key = tripCacheKey(id);
    const cached = await this.redis.getJson<{
      id: string;
      driverId: string | null;
      busId: string;
      status: TripStatus;
      routeName: string;
      destination: { lat: number; lng: number } | null;
    }>(key);
    if (cached) return cached;
    const trip = await this.trips.findOne({ where: { id }, relations: { route: { destination: true } } });
    if (!trip) return null;
    const info = {
      id: trip.id,
      driverId: trip.driverId,
      busId: trip.busId,
      status: trip.status,
      routeName: trip.route?.name ?? '',
      destination: trip.route?.destination
        ? { lat: trip.route.destination.latitude, lng: trip.route.destination.longitude }
        : null,
    };
    await this.redis.setJson(key, info, 30);
    return info;
  }

  async active() {
    return this.trips.find({
      where: { status: In([TripStatus.BOARDING, TripStatus.IN_PROGRESS, TripStatus.DELAYED]) },
      relations: { route: { stops: { stop: true } }, bus: true, driver: true },
      order: { departureAt: 'ASC' },
    });
  }
}
