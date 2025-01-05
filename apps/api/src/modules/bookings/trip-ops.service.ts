import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, IsNull, Repository } from 'typeorm';
import { BookingStatus, TripStatus } from '@bus/types';
import { Events } from '@bus/events';
import { AppException } from '@bus/shared';
import { Trip } from '../trips/trip.entity';
import { Booking } from './booking.entity';
import { TripsService } from '../trips/trips.service';
import { SettingsService } from '../settings/settings.service';
import { AuthUser } from '../../common/decorators';
import { BookingsService, isStaff } from './bookings.service';

@Injectable()
export class TripOpsService {
  private readonly logger = new Logger(TripOpsService.name);

  constructor(
    @InjectRepository(Trip) private readonly repo: Repository<Trip>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    private readonly trips: TripsService,
    private readonly bookings: BookingsService,
    private readonly settings: SettingsService,
    private readonly ds: DataSource,
  ) {}

  private assertDriver(trip: Trip, user?: AuthUser) {
    if (!user || isStaff(user)) return;
    if (!user.driverId || trip.driverId !== user.driverId) throw new AppException('DRIVER_NOT_ASSIGNED', HttpStatus.FORBIDDEN);
  }

  async assertDriverAccess(id: string, user: AuthUser) {
    this.assertDriver(await this.trips.get(id), user);
  }

  private assertStatus(trip: Trip, allowed: TripStatus[]) {
    if (!allowed.includes(trip.status))
      throw new AppException('TRIP_INVALID_STATUS', HttpStatus.CONFLICT, { status: trip.status });
  }

  async boarding(id: string, user?: AuthUser) {
    const trip = await this.trips.get(id);
    this.assertDriver(trip, user);
    this.assertStatus(trip, [TripStatus.SCHEDULED, TripStatus.DELAYED]);
    return this.trips.setStatus(id, TripStatus.BOARDING);
  }

  async start(id: string, user?: AuthUser, correlationId?: string) {
    const trip = await this.trips.get(id);
    this.assertDriver(trip, user);
    this.assertStatus(trip, [TripStatus.SCHEDULED, TripStatus.BOARDING, TripStatus.DELAYED]);
    if (!trip.driverId) throw new AppException('DRIVER_NOT_ASSIGNED', HttpStatus.CONFLICT);
    const updated = await this.trips.setStatus(id, TripStatus.IN_PROGRESS, { startedAt: new Date() });
    await this.trips.emitTrip(Events.TripStarted, updated, await this.trips.recipients(id), {}, correlationId);
    return updated;
  }

  async delay(id: string, minutes: number, reason?: string, correlationId?: string) {
    const trip = await this.trips.get(id);
    this.assertStatus(trip, [TripStatus.SCHEDULED, TripStatus.BOARDING, TripStatus.DELAYED, TripStatus.IN_PROGRESS]);
    const status = trip.status === TripStatus.IN_PROGRESS ? TripStatus.IN_PROGRESS : TripStatus.DELAYED;
    const updated = await this.trips.setStatus(id, status, { delayMinutes: minutes, statusReason: reason ?? null });
    await this.trips.emitTrip(Events.TripDelayed, updated, await this.trips.recipients(id), { delayMinutes: minutes, reason }, correlationId);
    return updated;
  }

  async cancel(id: string, reason: string | undefined, correlationId?: string) {
    const trip = await this.trips.get(id);
    this.assertStatus(trip, [TripStatus.SCHEDULED, TripStatus.BOARDING, TripStatus.DELAYED]);
    const recipients = await this.trips.recipients(id);
    const updated = await this.trips.setStatus(id, TripStatus.CANCELLED, { statusReason: reason ?? null });
    let cancelled = 0;
    for (const bookingId of await this.bookings.activeBookingIds(id)) {
      try {
        await this.bookings.cancel(bookingId, null, 'TRIP_CANCELLED', { force: true, correlationId });
        cancelled++;
      } catch (err) {
        this.logger.error(`Failed to cancel booking ${bookingId}: ${(err as Error).message}`);
      }
    }
    await this.trips.emitTrip(Events.TripCancelled, updated, recipients, { reason }, correlationId);
    return { ...updated, cancelledBookings: cancelled };
  }

  async complete(id: string, user?: AuthUser, correlationId?: string) {
    const trip = await this.trips.get(id);
    this.assertDriver(trip, user);
    this.assertStatus(trip, [TripStatus.IN_PROGRESS]);
    await this.ds.transaction((m) => this.bookings.completeTrip(m, id));
    const updated = await this.trips.setStatus(id, TripStatus.COMPLETED, { completedAt: new Date() });
    await this.trips.emitTrip(Events.TripCompleted, updated, [], {}, correlationId);
    return updated;
  }

  async sendReminders() {
    const before = await this.settings.num('trip.reminderBeforeMin');
    const trips = await this.repo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.route', 'r')
      .where('t.status IN (:...st)', { st: [TripStatus.SCHEDULED, TripStatus.BOARDING, TripStatus.DELAYED] })
      .andWhere('t.reminderSentAt IS NULL')
      .andWhere('t.departureAt BETWEEN now() AND now() + make_interval(mins => :before)', { before })
      .getMany();
    let sent = 0;
    for (const trip of trips) {
      const recipients = (await this.trips.recipients(trip.id)).filter(Boolean);
      const confirmed = await this.bookingRepo.find({
        where: { tripId: trip.id, status: BookingStatus.CONFIRMED },
        select: ['userId'],
      });
      const ids = new Set(confirmed.map((b) => b.userId));
      await this.trips.emitTrip(Events.TripReminder, trip, recipients.filter((r) => ids.has(r.userId)));
      await this.repo.update({ id: trip.id, reminderSentAt: IsNull() }, { reminderSentAt: new Date() });
      sent++;
    }
    return { trips: sent };
  }

  async autoStatus() {
    const boardingMin = await this.settings.num('trip.boardingBeforeMin');
    const toBoarding = await this.repo
      .createQueryBuilder('t')
      .where('t.status = :st', { st: TripStatus.SCHEDULED })
      .andWhere('t.departureAt <= now() + make_interval(mins => :m)', { m: boardingMin })
      .andWhere('t.departureAt > now() - interval \'15 minutes\'')
      .getMany();
    for (const t of toBoarding) await this.trips.setStatus(t.id, TripStatus.BOARDING);

    const stale = await this.repo
      .createQueryBuilder('t')
      .where('t.status = :st', { st: TripStatus.IN_PROGRESS })
      .andWhere('t.arrivalAt + make_interval(mins => t."delayMinutes") + interval \'6 hours\' < now()')
      .getMany();
    let completed = 0;
    for (const t of stale) {
      await this.complete(t.id).then(() => completed++).catch(() => undefined);
    }
    return { boarding: toBoarding.length, completed };
  }

  async checkDelays() {
    const threshold = await this.settings.num('trip.delayThresholdMin');
    const late = await this.repo
      .createQueryBuilder('t')
      .where('t.status IN (:...st)', { st: [TripStatus.SCHEDULED, TripStatus.BOARDING] })
      .andWhere(
        new Brackets((b) =>
          b.where('t.departureAt + make_interval(mins => t."delayMinutes" + :th) < now()', { th: threshold }),
        ),
      )
      .getMany();
    for (const t of late) {
      const minutes = Math.max(threshold, Math.round((Date.now() - t.departureAt.getTime()) / 60000));
      await this.delay(t.id, minutes, 'NOT_STARTED_ON_TIME').catch(() => undefined);
    }
    return { delayed: late.length };
  }

  async driverTrips(driverId: string, scope: 'today' | 'upcoming' | 'history') {
    const qb = this.repo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.route', 'r')
      .leftJoinAndSelect('r.stops', 'rs')
      .leftJoinAndSelect('rs.stop', 's')
      .leftJoinAndSelect('t.bus', 'b')
      .where('t.driverId = :driverId', { driverId });
    if (scope === 'today')
      qb.andWhere(
        new Brackets((b) =>
          b
            .where(`(t.departureAt AT TIME ZONE 'Asia/Tashkent')::date = (now() AT TIME ZONE 'Asia/Tashkent')::date`)
            .orWhere('t.status IN (:...active)', { active: [TripStatus.BOARDING, TripStatus.IN_PROGRESS, TripStatus.DELAYED] }),
        ),
      ).orderBy('t.departureAt', 'ASC');
    else if (scope === 'upcoming')
      qb.andWhere('t.departureAt >= now() AND t.status IN (:...st)', {
        st: [TripStatus.SCHEDULED, TripStatus.BOARDING, TripStatus.DELAYED, TripStatus.IN_PROGRESS],
      }).orderBy('t.departureAt', 'ASC');
    else qb.andWhere('t.status IN (:...st)', { st: [TripStatus.COMPLETED, TripStatus.CANCELLED] }).orderBy('t.departureAt', 'DESC');
    qb.take(50);
    const trips = await qb.getMany();
    for (const t of trips) t.route?.stops?.sort((a, b) => a.order - b.order);
    const stats = await this.trips.seatStats(trips.map((t) => t.id));
    return trips.map((t) => ({ ...t, seats: stats.get(t.id) }));
  }

  async activeTripIds() {
    const rows = await this.repo.find({
      where: { status: In([TripStatus.BOARDING, TripStatus.IN_PROGRESS, TripStatus.DELAYED]) },
      select: ['id'],
    });
    return rows.map((r) => r.id);
  }
}
