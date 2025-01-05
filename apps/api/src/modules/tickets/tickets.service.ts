import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AuditAction, RoleName, TicketStatus, TripStatus, VerificationResult } from '@bus/types';
import { Events, TicketEventPayload } from '@bus/events';
import { AppException, paginate, randomCode } from '@bus/shared';
import { Ticket } from './ticket.entity';
import { Booking } from '../bookings/booking.entity';
import { createQrToken, parseQrToken } from './qr-token';
import { EventsService } from '../../common/events.service';
import { AuditService } from '../../common/audit.service';
import { AuthUser } from '../../common/decorators';
import { PageQuery, pageResult } from '../../common/dto';

const STAFF = [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.DISPATCHER] as string[];

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    private readonly events: EventsService,
    private readonly audit: AuditService,
  ) {}

  async issue(m: EntityManager, booking: Booking) {
    const now = new Date();
    const rows = (booking.items ?? [])
      .filter((i) => i.active)
      .map((item) => {
        const id = randomUUID();
        return m.create(Ticket, {
          id,
          ticketNumber: `T${now.getFullYear().toString().slice(2)}${randomCode(8)}`,
          bookingId: booking.id,
          bookingItemId: item.id,
          passengerId: item.passengerId,
          tripId: booking.tripId,
          seatId: item.tripSeatId,
          seatNumber: item.seatNumber,
          qrToken: createQrToken(id),
          status: TicketStatus.ACTIVE,
          price: item.price,
          issuedAt: now,
        });
      });
    return m.save(Ticket, rows);
  }

  private query() {
    return this.tickets
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.passenger', 'p')
      .leftJoinAndSelect('t.booking', 'b')
      .leftJoinAndSelect('t.trip', 'tr')
      .leftJoinAndSelect('tr.route', 'r')
      .leftJoinAndSelect('tr.bus', 'bus')
      .leftJoinAndSelect('b.fromStop', 'fs')
      .leftJoinAndSelect('b.toStop', 'ts');
  }

  async mine(userId: string, q: PageQuery & { status?: TicketStatus }) {
    const { page, limit, skip } = paginate(q);
    const qb = this.query().where('b.userId = :userId', { userId }).orderBy('tr.departureAt', 'DESC').skip(skip).take(limit);
    if (q.status) qb.andWhere('t.status = :status', { status: q.status });
    const [items, total] = await qb.getManyAndCount();
    return pageResult(items.map((t) => this.view(t, true)), total, page, limit);
  }

  async list(q: PageQuery & { status?: TicketStatus; tripId?: string }) {
    const { page, limit, skip } = paginate(q);
    const qb = this.query().orderBy('t.issuedAt', 'DESC').skip(skip).take(limit);
    if (q.status) qb.andWhere('t.status = :status', { status: q.status });
    if (q.tripId) qb.andWhere('t.tripId = :tripId', { tripId: q.tripId });
    if (q.search)
      qb.andWhere('(t.ticketNumber ILIKE :s OR p.fullName ILIKE :s OR p.phone ILIKE :s OR b.code ILIKE :s)', {
        s: `%${q.search}%`,
      });
    const [items, total] = await qb.getManyAndCount();
    return pageResult(items.map((t) => this.view(t, false)), total, page, limit);
  }

  async get(id: string, user: AuthUser) {
    const ticket = await this.query().where('t.id = :id', { id }).getOne();
    if (!ticket) throw new AppException('TICKET_NOT_FOUND', HttpStatus.NOT_FOUND);
    const owner = ticket.booking?.userId === user.id;
    if (!owner && !user.permissions.includes('tickets.read') && !user.roles.includes(RoleName.SUPER_ADMIN))
      throw new AppException('TICKET_NOT_FOUND', HttpStatus.NOT_FOUND);
    return this.view(ticket, owner);
  }

  view(t: Ticket, withQr: boolean) {
    return {
      id: t.id,
      ticketNumber: t.ticketNumber,
      status: t.status,
      seatNumber: t.seatNumber,
      price: t.price,
      currency: t.booking?.currency ?? 'UZS',
      issuedAt: t.issuedAt,
      usedAt: t.usedAt,
      qrToken: withQr && t.status === TicketStatus.ACTIVE ? t.qrToken : null,
      bookingId: t.bookingId,
      bookingCode: t.booking?.code,
      passenger: t.passenger
        ? { id: t.passenger.id, fullName: t.passenger.fullName, phone: t.passenger.phone, documentNumber: t.passenger.documentNumber }
        : null,
      trip: t.trip
        ? {
            id: t.trip.id,
            status: t.trip.status,
            departureAt: t.trip.departureAt,
            arrivalAt: t.trip.arrivalAt,
            delayMinutes: t.trip.delayMinutes,
            route: t.trip.route ? { id: t.trip.route.id, name: t.trip.route.name } : null,
            bus: t.trip.bus ? { name: t.trip.bus.name, plateNumber: t.trip.bus.plateNumber } : null,
          }
        : null,
      from: t.booking?.fromStop ? { id: t.booking.fromStop.id, name: t.booking.fromStop.name, city: t.booking.fromStop.city } : null,
      to: t.booking?.toStop ? { id: t.booking.toStop.id, name: t.booking.toStop.name, city: t.booking.toStop.city } : null,
    };
  }

  async verify(token: string, user: AuthUser, tripId: string | undefined, req?: any) {
    const done = (result: VerificationResult, ticket: Ticket | null, reason?: string) => {
      const view = ticket ? this.view(ticket, false) : null;
      if (req)
        this.audit.fromRequest(req, {
          action: AuditAction.TICKET_VERIFIED,
          entity: 'ticket',
          entityId: ticket?.id ?? null,
          metadata: { result, reason, tripId },
        });
      if (ticket)
        this.events.emitLater<TicketEventPayload>(Events.TicketVerified, {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          bookingId: ticket.bookingId,
          tripId: ticket.tripId,
          seat: ticket.seatNumber,
          userId: ticket.booking?.userId ?? '',
          verifiedBy: user.id,
          result,
        });
      return { result, reason: reason ?? null, ticket: view, checkedAt: new Date().toISOString() };
    };

    const parsed = parseQrToken(token);
    if (!parsed) return done(VerificationResult.INVALID, null, 'BAD_SIGNATURE');
    const ticket = await this.query().where('t.id = :id AND t.qrToken = :token', { id: parsed.ticketId, token: token.trim() }).getOne();
    if (!ticket) return done(VerificationResult.INVALID, null, 'NOT_FOUND');

    const isStaff = user.roles.some((r) => STAFF.includes(r));
    if (tripId && ticket.tripId !== tripId) return done(VerificationResult.INVALID, ticket, 'WRONG_TRIP');
    if (!isStaff && (!user.driverId || ticket.trip?.driverId !== user.driverId))
      return done(VerificationResult.INVALID, ticket, 'WRONG_TRIP');

    if (ticket.status === TicketStatus.CANCELLED || ticket.trip?.status === TripStatus.CANCELLED)
      return done(VerificationResult.CANCELLED, ticket);
    if (ticket.status === TicketStatus.USED) return done(VerificationResult.ALREADY_USED, ticket);
    if (ticket.status === TicketStatus.EXPIRED || ticket.trip?.status === TripStatus.COMPLETED)
      return done(VerificationResult.EXPIRED, ticket);

    const usedAt = new Date();
    const res = await this.tickets
      .createQueryBuilder()
      .update(Ticket)
      .set({ status: TicketStatus.USED, usedAt, verifiedBy: user.id })
      .where('id = :id AND status = :active', { id: ticket.id, active: TicketStatus.ACTIVE })
      .execute();
    if (!res.affected) return done(VerificationResult.ALREADY_USED, ticket);
    ticket.status = TicketStatus.USED;
    ticket.usedAt = usedAt;
    return done(VerificationResult.VALID, ticket);
  }
}
