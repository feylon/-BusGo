import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import Redis from 'ioredis';
import { LocationPoint, VehicleLocation } from '@bus/types';
import { Events, TripEventPayload } from '@bus/events';
import { ServiceBus, haversineKm } from '@bus/shared';
import { LocationHistory } from './location.entity';

export const REDIS = 'REDIS';
export const TRACKING_CHANNEL = 'tracking:location';
const currentKey = (tripId: string) => `tracking:current:${tripId}`;
const ONLINE_MS = 60000;

export interface LocationInput extends LocationPoint {
  tripStatus?: string;
  destination?: { lat: number; lng: number } | null;
}

@Injectable()
export class TrackingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackingService.name);
  private buffer: Partial<LocationHistory>[] = [];
  private timer?: NodeJS.Timeout;
  private lastEvent = new Map<string, number>();

  constructor(
    @InjectRepository(LocationHistory) private readonly history: Repository<LocationHistory>,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly bus: ServiceBus,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.flush(), Number(process.env.TRACKING_FLUSH_MS) || 5000);
    const clear = async (e: { payload: TripEventPayload }) => {
      await this.redis.del(currentKey(e.payload.tripId));
    };
    this.bus.on<TripEventPayload>(Events.TripCompleted, clear);
    this.bus.on<TripEventPayload>(Events.TripCancelled, clear);
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }

  async flush() {
    if (!this.buffer.length) return;
    const rows = this.buffer.splice(0, this.buffer.length);
    try {
      await this.history.insert(rows);
    } catch (err) {
      this.logger.error(`History flush failed (${rows.length} points): ${(err as Error).message}`);
      if (this.buffer.length < 20000) this.buffer.unshift(...rows);
    }
  }

  async record(input: LocationInput): Promise<VehicleLocation> {
    const ts = new Date(input.timestamp || Date.now());
    const prevRaw = await this.redis.get(currentKey(input.tripId));
    const prev: VehicleLocation | null = prevRaw ? JSON.parse(prevRaw) : null;

    let speed = input.speed ?? 0;
    if (!speed && prev) {
      const dt = (ts.getTime() - new Date(prev.timestamp).getTime()) / 3600000;
      if (dt > 0) speed = Math.min(150, haversineKm(prev.latitude, prev.longitude, input.latitude, input.longitude) / dt);
    }

    let distanceLeftKm: number | null = null;
    let etaMinutes: number | null = null;
    if (input.destination) {
      distanceLeftKm = Math.round(haversineKm(input.latitude, input.longitude, input.destination.lat, input.destination.lng) * 1.2 * 10) / 10;
      const avg = speed > 20 ? speed * 0.85 : 60;
      etaMinutes = Math.round((distanceLeftKm / avg) * 60);
    }

    const location: VehicleLocation = {
      tripId: input.tripId,
      vehicleId: input.vehicleId,
      driverId: input.driverId,
      latitude: input.latitude,
      longitude: input.longitude,
      speed: Math.round(speed * 10) / 10,
      heading: input.heading ?? 0,
      accuracy: input.accuracy ?? 0,
      timestamp: ts.toISOString(),
      online: true,
      lastSeen: new Date().toISOString(),
      distanceLeftKm,
      etaMinutes,
      etaAt: etaMinutes !== null ? new Date(Date.now() + etaMinutes * 60000).toISOString() : null,
      tripStatus: input.tripStatus,
    };

    await this.redis
      .multi()
      .set(currentKey(input.tripId), JSON.stringify(location), 'EX', 86400)
      .sadd('tracking:active', input.tripId)
      .publish(TRACKING_CHANNEL, JSON.stringify(location))
      .exec();

    this.buffer.push({
      tripId: input.tripId,
      vehicleId: input.vehicleId,
      driverId: input.driverId,
      latitude: input.latitude,
      longitude: input.longitude,
      speed: location.speed,
      heading: location.heading,
      accuracy: location.accuracy,
      recordedAt: ts,
    });
    if (this.buffer.length >= 500) void this.flush();

    const last = this.lastEvent.get(input.tripId) ?? 0;
    if (Date.now() - last > 30000) {
      this.lastEvent.set(input.tripId, Date.now());
      void this.bus.emit<LocationPoint>(Events.TrackingLocationUpdated, {
        tripId: location.tripId,
        vehicleId: location.vehicleId,
        driverId: location.driverId,
        latitude: location.latitude,
        longitude: location.longitude,
        speed: location.speed,
        heading: location.heading,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
      });
    }
    return location;
  }

  private withStatus(raw: string | null): VehicleLocation | null {
    if (!raw) return null;
    const loc: VehicleLocation = JSON.parse(raw);
    loc.online = Date.now() - new Date(loc.lastSeen).getTime() < ONLINE_MS;
    return loc;
  }

  async current(tripId: string) {
    return this.withStatus(await this.redis.get(currentKey(tripId)));
  }

  async batch(tripIds: string[]) {
    if (!tripIds.length) return [];
    const rows = await this.redis.mget(tripIds.map(currentKey));
    return rows.map((r) => this.withStatus(r)).filter(Boolean) as VehicleLocation[];
  }

  async active() {
    const ids = await this.redis.smembers('tracking:active');
    const locs = await this.batch(ids);
    const stale = ids.filter((id) => !locs.some((l) => l.tripId === id));
    if (stale.length) await this.redis.srem('tracking:active', ...stale);
    return locs;
  }

  async trail(tripId: string, limit = 500) {
    await this.flush();
    const rows = await this.history.find({ where: { tripId }, order: { recordedAt: 'DESC' }, take: Math.min(limit, 5000) });
    return rows.reverse().map((r) => ({
      latitude: r.latitude,
      longitude: r.longitude,
      speed: r.speed,
      heading: r.heading,
      recordedAt: r.recordedAt,
    }));
  }

  async cleanup(days = Number(process.env.TRACKING_RETENTION_DAYS) || 30) {
    const res = await this.history.delete({ recordedAt: LessThan(new Date(Date.now() - days * 86400000)) });
    return { deleted: res.affected ?? 0 };
  }
}
