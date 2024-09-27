import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { BOOKABLE_TRIP_STATUSES, TripSeatStatus } from '@bus/types';
import { Events, SeatEventPayload } from '@bus/events';
import { AppException } from '@bus/shared';
import { TripSeat } from './trip-seat.entity';
import { Trip } from './trip.entity';
import { RedisService } from '../../common/redis.service';
import { EventsService } from '../../common/events.service';
import { SettingsService } from '../settings/settings.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const RELEASE_SCRIPT = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;

export const lockKey = (tripId: string, seatId: string) => `seat-lock:${tripId}:${seatId}`;

@Injectable()
export class SeatLockService {
  constructor(
    @InjectRepository(TripSeat) private readonly seats: Repository<TripSeat>,
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
    private readonly redis: RedisService,
    private readonly events: EventsService,
    private readonly settings: SettingsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async assertBookable(trip: Trip) {
    const closeMin = await this.settings.num('booking.salesCloseBeforeDepartureMin');
    if (!BOOKABLE_TRIP_STATUSES.includes(trip.status)) throw new AppException('TRIP_NOT_BOOKABLE', HttpStatus.CONFLICT);
    if (trip.departureAt.getTime() - closeMin * 60000 < Date.now())
      throw new AppException('TRIP_NOT_BOOKABLE', HttpStatus.CONFLICT);
  }

  async lock(tripId: string, seatId: string, userId: string) {
    const trip = await this.trips.findOne({ where: { id: tripId } });
    if (!trip) throw new AppException('TRIP_NOT_FOUND', HttpStatus.NOT_FOUND);
    await this.assertBookable(trip);
    const seat = await this.seats.findOne({ where: { id: seatId, tripId } });
    if (!seat) throw new AppException('SEAT_NOT_FOUND', HttpStatus.NOT_FOUND);
    if ([TripSeatStatus.RESERVED, TripSeatStatus.SOLD, TripSeatStatus.BLOCKED].includes(seat.status))
      throw new AppException('SEAT_NOT_AVAILABLE', HttpStatus.CONFLICT);

    const ttl = await this.settings.num('booking.seatLockTtlSec');
    const max = await this.settings.num('booking.maxSeatsPerBooking');
    const mine = await this.seats.count({
      where: { tripId, lockedBy: userId, status: TripSeatStatus.LOCKED },
    });
    const alreadyMine = seat.lockedBy === userId && seat.status === TripSeatStatus.LOCKED;
    if (!alreadyMine && mine >= max) throw new AppException('SEAT_LOCK_LIMIT', HttpStatus.CONFLICT, { max });

    const key = lockKey(tripId, seatId);
    const acquired = await this.redis.client.set(key, userId, 'EX', ttl, 'NX');
    if (!acquired) {
      const owner = await this.redis.client.get(key);
      if (owner !== userId) throw new AppException('SEAT_LOCKED_BY_OTHER', HttpStatus.CONFLICT);
      await this.redis.client.expire(key, ttl);
    }

    const lockedUntil = new Date(Date.now() + ttl * 1000);
    const res = await this.seats
      .createQueryBuilder()
      .update(TripSeat)
      .set({ status: TripSeatStatus.LOCKED, lockedBy: userId, lockedUntil })
      .where('id = :id AND "tripId" = :tripId', { id: seatId, tripId })
      .andWhere(
        `(status = :available OR (status = :locked AND ("lockedUntil" < now() OR "lockedBy" = :userId)))`,
        { available: TripSeatStatus.AVAILABLE, locked: TripSeatStatus.LOCKED, userId },
      )
      .execute();
    if (!res.affected) {
      await this.redis.client.eval(RELEASE_SCRIPT, 1, key, userId);
      throw new AppException('SEAT_NOT_AVAILABLE', HttpStatus.CONFLICT);
    }

    this.broadcast(tripId, { ...seat, status: TripSeatStatus.LOCKED, lockedBy: userId, lockedUntil });
    this.events.emitLater<SeatEventPayload>(Events.SeatLocked, {
      tripId,
      seatId,
      number: seat.number,
      userId,
      status: TripSeatStatus.LOCKED,
    });
    return { seatId, number: seat.number, status: TripSeatStatus.LOCKED, lockedUntil, ttl };
  }

  async unlock(tripId: string, seatId: string, userId: string) {
    await this.redis.client.eval(RELEASE_SCRIPT, 1, lockKey(tripId, seatId), userId);
    const res = await this.seats.update(
      { id: seatId, tripId, lockedBy: userId, status: TripSeatStatus.LOCKED },
      { status: TripSeatStatus.AVAILABLE, lockedBy: null, lockedUntil: null },
    );
    if (res.affected) {
      const seat = await this.seats.findOneByOrFail({ id: seatId });
      this.broadcast(tripId, seat);
      this.events.emitLater<SeatEventPayload>(Events.SeatReleased, {
        tripId,
        seatId,
        number: seat.number,
        userId,
        status: TripSeatStatus.AVAILABLE,
      });
    }
    return { seatId, released: !!res.affected };
  }

  async unlockAll(tripId: string, userId: string) {
    const seats = await this.seats.find({ where: { tripId, lockedBy: userId, status: TripSeatStatus.LOCKED } });
    for (const s of seats) await this.unlock(tripId, s.id, userId);
    return { released: seats.length };
  }

  async ownsLock(tripId: string, seatId: string, userId: string) {
    return (await this.redis.client.get(lockKey(tripId, seatId))) === userId;
  }

  async clearLocks(tripId: string, seatIds: string[], userId: string) {
    for (const id of seatIds) await this.redis.client.eval(RELEASE_SCRIPT, 1, lockKey(tripId, id), userId);
  }

  async releaseExpired() {
    const expired = await this.seats.find({
      where: { status: TripSeatStatus.LOCKED, lockedUntil: LessThan(new Date()) },
      take: 1000,
    });
    if (!expired.length) return { released: 0 };
    const res = await this.seats
      .createQueryBuilder()
      .update(TripSeat)
      .set({ status: TripSeatStatus.AVAILABLE, lockedBy: null, lockedUntil: null })
      .where({ id: In(expired.map((s) => s.id)) })
      .andWhere('status = :locked AND "lockedUntil" < now()', { locked: TripSeatStatus.LOCKED })
      .execute();
    for (const s of expired) {
      this.broadcast(s.tripId, { ...s, status: TripSeatStatus.AVAILABLE, lockedBy: null, lockedUntil: null });
      this.events.emitLater<SeatEventPayload>(Events.SeatReleased, {
        tripId: s.tripId,
        seatId: s.id,
        number: s.number,
        userId: s.lockedBy,
        status: TripSeatStatus.AVAILABLE,
      });
    }
    return { released: res.affected ?? 0 };
  }

  broadcast(tripId: string, seat: Partial<TripSeat>) {
    this.realtime.toTrip(tripId, 'seat.updated', {
      tripId,
      seatId: seat.id,
      number: seat.number,
      status: seat.status,
      lockedBy: seat.lockedBy ?? null,
      lockedUntil: seat.lockedUntil ?? null,
    });
  }
}
