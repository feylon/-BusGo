import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, LessThan, QueryFailedError, Repository } from 'typeorm';
import { BookingStatus, RoleName, TicketStatus, TripSeatStatus } from '@bus/types';
import { BookingEventPayload, Events, TicketEventPayload } from '@bus/events';
import { AppException, normalizePhone, paginate, randomCode } from '@bus/shared';
import { Booking } from './booking.entity';
import { BookingItem } from './booking-item.entity';
import { Passenger } from '../passengers/passenger.entity';
import { TripSeat } from '../trips/trip-seat.entity';
import { Trip } from '../trips/trip.entity';
import { Ticket } from '../tickets/ticket.entity';
import { User } from '../users/user.entity';
import { TripsService } from '../trips/trips.service';
import { SeatLockService } from '../trips/seat-lock.service';
import { PricingService } from '../pricing/pricing.service';
import { SettingsService } from '../settings/settings.service';
import { TicketsService } from '../tickets/tickets.service';
import { EventsService } from '../../common/events.service';
import { ClientsService } from '../../common/clients.service';
import { AuthUser } from '../../common/decorators';
import { pageResult } from '../../common/dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { BookingQuery, CreateBookingDto } from './bookings.dto';

const STAFF = [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.DISPATCHER] as string[];
const TZ = 'Asia/Tashkent';

export const isStaff = (user: AuthUser) => user.roles.some((r) => STAFF.includes(r));

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(TripSeat) private readonly seats: Repository<TripSeat>,
    private readonly ds: DataSource,
    private readonly trips: TripsService,
    private readonly locks: SeatLockService,
    private readonly pricing: PricingService,
    private readonly settings: SettingsService,
    private readonly tickets: TicketsService,
    private readonly events: EventsService,
    private readonly clients: ClientsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async create(dto: CreateBookingDto, user: AuthUser, channel = 'WEB', correlationId?: string) {
    const max = await this.settings.num('booking.maxSeatsPerBooking');
    const seatIds = dto.seats.map((s) => s.seatId);
    if (new Set(seatIds).size !== seatIds.length) throw new AppException('VALIDATION_ERROR', HttpStatus.BAD_REQUEST, ['duplicate seats']);
    if (seatIds.length > max) throw new AppException('SEAT_LOCK_LIMIT', HttpStatus.BAD_REQUEST, { max });
    for (const s of dto.seats) {
      const phone = normalizePhone(s.passenger.phone);
      if (!phone) throw new AppException('INVALID_PHONE', HttpStatus.BAD_REQUEST, { passenger: s.passenger.fullName });
      s.passenger.phone = phone;
    }

    const trip = await this.trips.get(dto.tripId);
    await this.locks.assertBookable(trip);
    const seg = await this.pricing.segment(trip.routeId, dto.fromStopId, dto.toStopId);

    for (const id of seatIds) {
      if (!(await this.locks.ownsLock(trip.id, id, user.id))) await this.locks.lock(trip.id, id, user.id);
    }

    const timeoutMin = await this.settings.num('booking.paymentTimeoutMin');
    let bookingId: string;
    try {
      bookingId = await this.ds.transaction(async (m) => {
        const seats = await m
          .createQueryBuilder(TripSeat, 's')
          .setLock('pessimistic_write')
          .where('s.id IN (:...ids) AND s.tripId = :tripId', { ids: seatIds, tripId: trip.id })
          .getMany();
        if (seats.length !== seatIds.length) throw new AppException('SEAT_NOT_FOUND', HttpStatus.NOT_FOUND);
        for (const s of seats) {
          if (s.status !== TripSeatStatus.LOCKED || s.lockedBy !== user.id)
            throw new AppException('SEAT_NOT_AVAILABLE', HttpStatus.CONFLICT, { seat: s.number });
        }

        const items: Partial<BookingItem>[] = [];
        let total = 0;
        for (const req of dto.seats) {
          const seat = seats.find((s) => s.id === req.seatId)!;
          const { price } = await this.pricing.quote({
            routeId: trip.routeId,
            basePrice: trip.price,
            seg,
            seatType: seat.type,
            at: trip.departureAt,
          });
          const passenger = await m.save(
            m.create(Passenger, {
              userId: user.id,
              fullName: req.passenger.fullName.trim(),
              phone: req.passenger.phone,
              documentNumber: req.passenger.documentNumber?.toUpperCase() || null,
              birthDate: req.passenger.birthDate ?? null,
              gender: req.passenger.gender ?? null,
            }),
          );
          total += price;
          items.push({ tripId: trip.id, tripSeatId: seat.id, passengerId: passenger.id, seatNumber: seat.number, price, active: true });
        }

        const booking = await m.save(
          m.create(Booking, {
            code: randomCode(8),
            userId: user.id,
            tripId: trip.id,
            fromStopId: seg.from.stopId,
            toStopId: seg.to.stopId,
            status: BookingStatus.PENDING,
            totalAmount: total,
            currency: trip.currency,
            expiresAt: new Date(Date.now() + timeoutMin * 60000),
            channel,
          }),
        );
        await m.insert(
          BookingItem,
          items.map((i) => ({ ...i, bookingId: booking.id })),
        );
        const res = await m
          .createQueryBuilder()
          .update(TripSeat)
          .set({ status: TripSeatStatus.RESERVED, bookingId: booking.id, lockedBy: null, lockedUntil: null })
          .where('id IN (:...ids) AND status = :locked AND "lockedBy" = :userId', {
            ids: seatIds,
            locked: TripSeatStatus.LOCKED,
            userId: user.id,
          })
          .execute();
        if (res.affected !== seatIds.length) throw new AppException('SEAT_NOT_AVAILABLE', HttpStatus.CONFLICT);
        return booking.id;
      });
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).driverError?.code === '23505')
        throw new AppException('SEAT_NOT_AVAILABLE', HttpStatus.CONFLICT);
      throw err;
    }

    await this.locks.clearLocks(trip.id, seatIds, user.id);
    const booking = await this.load(bookingId);
    this.broadcastSeats(booking, TripSeatStatus.RESERVED);
    await this.emit(Events.BookingCreated, booking, undefined, correlationId);
    return this.view(booking);
  }

  async load(id: string, m?: EntityManager) {
    const repo = m ? m.getRepository(Booking) : this.bookings;
    const booking = await repo.findOne({
      where: { id },
      relations: { items: true, trip: { route: true, bus: true }, fromStop: true, toStop: true, user: true },
    });
    if (!booking) throw new AppException('BOOKING_NOT_FOUND', HttpStatus.NOT_FOUND);
    return booking;
  }

  async get(id: string, user: AuthUser) {
    const booking = await this.load(id);
    if (booking.userId !== user.id && !isStaff(user)) throw new AppException('BOOKING_NOT_FOUND', HttpStatus.NOT_FOUND);
    const tickets = await this.ds.getRepository(Ticket).find({ where: { bookingId: id }, order: { seatNumber: 'ASC' } });
    return {
      ...this.view(booking),
      tickets: tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        seatNumber: t.seatNumber,
        status: t.status,
        passenger: t.passenger?.fullName,
        qrToken: booking.userId === user.id && t.status === TicketStatus.ACTIVE ? t.qrToken : null,
      })),
    };
  }

  view(b: Booking) {
    return {
      id: b.id,
      code: b.code,
      status: b.status,
      totalAmount: b.totalAmount,
      currency: b.currency,
      expiresAt: b.expiresAt,
      paymentId: b.paymentId,
      paymentStatus: b.paymentStatus,
      channel: b.channel,
      createdAt: b.createdAt,
      confirmedAt: b.confirmedAt,
      cancelledAt: b.cancelledAt,
      cancelReason: b.cancelReason,
      user: b.user ? { id: b.user.id, fullName: b.user.fullName, phone: b.user.phone } : undefined,
      trip: b.trip
        ? {
            id: b.trip.id,
            status: b.trip.status,
            departureAt: b.trip.departureAt,
            arrivalAt: b.trip.arrivalAt,
            delayMinutes: b.trip.delayMinutes,
            route: b.trip.route ? { id: b.trip.route.id, name: b.trip.route.name } : null,
            bus: b.trip.bus ? { name: b.trip.bus.name, plateNumber: b.trip.bus.plateNumber, model: b.trip.bus.model } : null,
          }
        : null,
      from: b.fromStop ? { id: b.fromStop.id, name: b.fromStop.name, city: b.fromStop.city } : null,
      to: b.toStop ? { id: b.toStop.id, name: b.toStop.name, city: b.toStop.city } : null,
      items: (b.items ?? []).map((i) => ({
        id: i.id,
        seatId: i.tripSeatId,
        seatNumber: i.seatNumber,
        price: i.price,
        active: i.active,
        passenger: i.passenger
          ? { id: i.passenger.id, fullName: i.passenger.fullName, phone: i.passenger.phone, documentNumber: i.passenger.documentNumber }
          : null,
      })),
    };
  }

  async list(q: BookingQuery, userId?: string) {
    const { page, limit, skip } = paginate(q);
    const qb = this.bookings
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.items', 'i')
      .leftJoinAndSelect('i.passenger', 'p')
      .leftJoinAndSelect('b.trip', 't')
      .leftJoinAndSelect('t.route', 'r')
      .leftJoinAndSelect('t.bus', 'bus')
      .leftJoinAndSelect('b.fromStop', 'fs')
      .leftJoinAndSelect('b.toStop', 'ts')
      .leftJoinAndSelect('b.user', 'u')
      .orderBy('b.createdAt', 'DESC')
      .skip(skip)
      .take(limit);
    if (userId) qb.andWhere('b.userId = :userId', { userId });
    else if (q.userId) qb.andWhere('b.userId = :uid', { uid: q.userId });
    if (q.status) qb.andWhere('b.status = :status', { status: q.status });
    if (q.tripId) qb.andWhere('b.tripId = :tripId', { tripId: q.tripId });
    if (q.from) qb.andWhere(`(b.createdAt AT TIME ZONE '${TZ}')::date >= :from`, { from: q.from });
    if (q.to) qb.andWhere(`(b.createdAt AT TIME ZONE '${TZ}')::date <= :to`, { to: q.to });
    if (q.search)
      qb.andWhere('(b.code ILIKE :s OR u.phone ILIKE :s OR u.fullName ILIKE :s OR p.fullName ILIKE :s)', { s: `%${q.search}%` });
    const [items, total] = await qb.getManyAndCount();
    return pageResult(items.map((b) => this.view(b)), total, page, limit);
  }

  async confirmPaid(bookingId: string, paymentId: string, correlationId?: string) {
    let refund = false;
    const confirmed = await this.ds.transaction(async (m) => {
      const locked = await m
        .createQueryBuilder(Booking, 'b')
        .setLock('pessimistic_write')
        .where('b.id = :id', { id: bookingId })
        .getOne();
      if (!locked) throw new AppException('BOOKING_NOT_FOUND', HttpStatus.NOT_FOUND);
      if (locked.status === BookingStatus.CONFIRMED || locked.status === BookingStatus.COMPLETED) return null;
      if (locked.status !== BookingStatus.PENDING) {
        refund = true;
        await m.update(Booking, bookingId, { paymentId, paymentStatus: 'REFUND_PENDING' });
        return null;
      }
      await m.update(Booking, bookingId, {
        status: BookingStatus.CONFIRMED,
        paymentId,
        paymentStatus: 'SUCCEEDED',
        confirmedAt: new Date(),
        expiresAt: null,
      });
      await m.update(TripSeat, { bookingId, status: TripSeatStatus.RESERVED }, { status: TripSeatStatus.SOLD });
      const booking = await this.load(bookingId, m);
      const tickets = await this.tickets.issue(m, booking);
      return { booking, tickets };
    });

    if (refund) {
      this.logger.warn(`Payment ${paymentId} succeeded for inactive booking ${bookingId}, refunding`);
      await this.clients.payment
        .post(`/payments/${paymentId}/refund`, { reason: 'BOOKING_NOT_ACTIVE' }, { correlationId })
        .catch((e) => this.logger.error(`Refund failed: ${e.message}`));
      return { confirmed: false, refunded: true };
    }
    if (!confirmed) return { confirmed: true, duplicate: true };

    const { booking, tickets } = confirmed;
    this.broadcastSeats(booking, TripSeatStatus.SOLD);
    await this.emit(Events.BookingConfirmed, booking, undefined, correlationId);
    for (const t of tickets) {
      await this.events.emit<TicketEventPayload>(
        Events.TicketCreated,
        {
          ticketId: t.id,
          ticketNumber: t.ticketNumber,
          bookingId: booking.id,
          tripId: booking.tripId,
          seat: t.seatNumber,
          userId: booking.userId,
          recipient: { userId: booking.userId, phone: booking.user?.phone, lang: booking.user?.lang as any },
        },
        correlationId,
      );
    }
    this.realtime.toUser(booking.userId, 'booking.updated', { id: booking.id, status: BookingStatus.CONFIRMED });
    return { confirmed: true, tickets: tickets.length };
  }

  async markPayment(bookingId: string, paymentId: string, status: string) {
    await this.bookings.update({ id: bookingId }, { paymentId, paymentStatus: status });
    const booking = await this.bookings.findOne({ where: { id: bookingId } });
    if (booking) this.realtime.toUser(booking.userId, 'booking.updated', { id: bookingId, status: booking.status, paymentStatus: status });
  }

  async cancel(id: string, user: AuthUser | null, reason: string, opts: { force?: boolean; correlationId?: string } = {}) {
    const staff = !user || isStaff(user);
    const pre = await this.load(id);
    if (user && !staff && pre.userId !== user.id) throw new AppException('BOOKING_NOT_FOUND', HttpStatus.NOT_FOUND);
    if (![BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(pre.status))
      throw new AppException('BOOKING_INVALID_STATUS', HttpStatus.CONFLICT);
    if (!staff && !opts.force && pre.status === BookingStatus.CONFIRMED) {
      const before = await this.settings.num('booking.cancelBeforeDepartureMin');
      if (pre.trip!.departureAt.getTime() - before * 60000 < Date.now())
        throw new AppException('BOOKING_CANNOT_CANCEL', HttpStatus.CONFLICT);
    }
    const wasPaid = pre.paymentStatus === 'SUCCEEDED';
    const done = await this.ds.transaction(async (m) => {
      const b = await m.createQueryBuilder(Booking, 'b').setLock('pessimistic_write').where('b.id = :id', { id }).getOne();
      if (!b || ![BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(b.status)) return false;
      await this.release(m, id, BookingStatus.CANCELLED, {
        cancelledAt: new Date(),
        cancelReason: reason,
        ...(wasPaid ? { paymentStatus: 'REFUND_PENDING' } : {}),
      });
      await m.update(Ticket, { bookingId: id, status: TicketStatus.ACTIVE }, { status: TicketStatus.CANCELLED });
      return true;
    });
    if (!done) throw new AppException('BOOKING_INVALID_STATUS', HttpStatus.CONFLICT);

    if (pre.paymentId) {
      const path = wasPaid ? `/payments/${pre.paymentId}/refund` : `/payments/${pre.paymentId}/cancel`;
      await this.clients.payment
        .post(path, { reason }, { correlationId: opts.correlationId })
        .catch((e) => this.logger.error(`Payment ${path} failed: ${e.message}`));
    }
    const booking = await this.load(id);
    this.broadcastSeats(booking, TripSeatStatus.AVAILABLE);
    await this.emit(Events.BookingCancelled, booking, reason, opts.correlationId);
    this.realtime.toUser(booking.userId, 'booking.updated', { id, status: BookingStatus.CANCELLED });
    return this.view(booking);
  }

  private async release(m: EntityManager, bookingId: string, status: BookingStatus, patch: Partial<Booking> = {}) {
    await m.update(Booking, bookingId, { status, expiresAt: null, ...patch });
    await m.update(BookingItem, { bookingId }, { active: false });
    await m.update(
      TripSeat,
      { bookingId },
      { status: TripSeatStatus.AVAILABLE, bookingId: null, lockedBy: null, lockedUntil: null },
    );
  }

  async expirePending() {
    const due = await this.bookings.find({
      where: { status: BookingStatus.PENDING, expiresAt: LessThan(new Date()) },
      take: 200,
    });
    let expired = 0;
    for (const b of due) {
      const ok = await this.ds.transaction(async (m) => {
        const locked = await m
          .createQueryBuilder(Booking, 'b')
          .setLock('pessimistic_write')
          .where('b.id = :id AND b.status = :pending', { id: b.id, pending: BookingStatus.PENDING })
          .getOne();
        if (!locked) return false;
        await this.release(m, b.id, BookingStatus.EXPIRED, { cancelReason: 'PAYMENT_TIMEOUT' });
        return true;
      });
      if (!ok) continue;
      expired++;
      if (b.paymentId)
        await this.clients.payment.post(`/payments/${b.paymentId}/cancel`, { reason: 'PAYMENT_TIMEOUT' }).catch(() => undefined);
      const booking = await this.load(b.id);
      this.broadcastSeats(booking, TripSeatStatus.AVAILABLE);
      await this.emit(Events.BookingExpired, booking, 'PAYMENT_TIMEOUT');
      this.realtime.toUser(booking.userId, 'booking.updated', { id: b.id, status: BookingStatus.EXPIRED });
    }
    return { expired };
  }

  async completeTrip(m: EntityManager, tripId: string) {
    await m.update(Ticket, { tripId, status: TicketStatus.ACTIVE }, { status: TicketStatus.EXPIRED });
    await m.update(Booking, { tripId, status: BookingStatus.CONFIRMED }, { status: BookingStatus.COMPLETED });
    const pending = await m.find(Booking, { where: { tripId, status: BookingStatus.PENDING } });
    for (const b of pending) await this.release(m, b.id, BookingStatus.EXPIRED, { cancelReason: 'TRIP_COMPLETED' });
  }

  async activeBookingIds(tripId: string) {
    const rows = await this.bookings.find({
      where: { tripId, status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]) },
      select: ['id'],
    });
    return rows.map((r) => r.id);
  }

  async passengers(tripId: string) {
    const items = await this.ds
      .getRepository(BookingItem)
      .createQueryBuilder('i')
      .innerJoinAndSelect('i.booking', 'b')
      .leftJoinAndSelect('i.passenger', 'p')
      .leftJoinAndSelect('b.fromStop', 'fs')
      .leftJoinAndSelect('b.toStop', 'ts')
      .where('i.tripId = :tripId AND i.active = true', { tripId })
      .andWhere('b.status IN (:...st)', { st: [BookingStatus.CONFIRMED, BookingStatus.PENDING, BookingStatus.COMPLETED] })
      .orderBy('i.seatNumber', 'ASC')
      .getMany();
    const tickets = items.length
      ? await this.ds.getRepository(Ticket).find({ where: { bookingItemId: In(items.map((i) => i.id)) } })
      : [];
    return items.map((i) => {
      const t = tickets.find((x) => x.bookingItemId === i.id);
      return {
        itemId: i.id,
        seatNumber: i.seatNumber,
        price: i.price,
        bookingId: i.bookingId,
        bookingCode: i.booking?.code,
        bookingStatus: i.booking?.status,
        passenger: i.passenger
          ? { fullName: i.passenger.fullName, phone: i.passenger.phone, documentNumber: i.passenger.documentNumber }
          : null,
        from: i.booking?.fromStop?.name,
        to: i.booking?.toStop?.name,
        ticket: t ? { id: t.id, ticketNumber: t.ticketNumber, status: t.status, usedAt: t.usedAt } : null,
      };
    });
  }

  private broadcastSeats(booking: Booking, status: TripSeatStatus) {
    for (const i of booking.items ?? []) {
      this.realtime.toTrip(booking.tripId, 'seat.updated', {
        tripId: booking.tripId,
        seatId: i.tripSeatId,
        number: i.seatNumber,
        status,
      });
    }
  }

  async emit(type: string, b: Booking, reason?: string, correlationId?: string) {
    const trip = b.trip as Trip;
    const user = b.user as User;
    await this.events.emit<BookingEventPayload>(
      type,
      {
        bookingId: b.id,
        code: b.code,
        userId: b.userId,
        tripId: b.tripId,
        routeId: trip?.routeId,
        routeName: trip?.route?.name ?? '',
        busId: trip?.busId,
        driverId: trip?.driverId ?? null,
        departureAt: trip?.departureAt?.toISOString(),
        amount: b.totalAmount,
        currency: b.currency,
        seats: (b.items ?? []).map((i) => i.seatNumber),
        seatCount: (b.items ?? []).length,
        passengerIds: (b.items ?? []).map((i) => i.passengerId),
        status: b.status,
        reason,
        recipient: { userId: b.userId, phone: user?.phone, lang: (user?.lang as any) ?? 'uz' },
      },
      correlationId,
    );
  }
}
