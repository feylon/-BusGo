import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeatType } from '@bus/types';
import { Setting } from './setting.entity';
import { RedisService } from '../../common/redis.service';

export const DEFAULT_SETTINGS = {
  'booking.paymentTimeoutMin': 15,
  'booking.seatLockTtlSec': 600,
  'booking.maxSeatsPerBooking': 6,
  'booking.cancelBeforeDepartureMin': 60,
  'booking.salesCloseBeforeDepartureMin': 10,
  'pricing.seatMultipliers': { STANDARD: 1, COMFORT: 1.2, VIP: 1.5, ACCESSIBLE: 1 },
  'trip.reminderBeforeMin': 120,
  'trip.boardingBeforeMin': 30,
  'trip.delayThresholdMin': 15,
  'company.name': 'BusLine',
  'company.phone': '+998 71 200 00 00',
  'company.currency': 'UZS',
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting) private readonly repo: Repository<Setting>,
    private readonly redis: RedisService,
  ) {}

  async all(): Promise<Record<string, unknown>> {
    const cached = await this.redis.getJson<Record<string, unknown>>('settings:all').catch(() => null);
    if (cached) return cached;
    const rows = await this.repo.find();
    const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const r of rows) result[r.key] = r.value;
    await this.redis.setJson('settings:all', result, 300).catch(() => undefined);
    return result;
  }

  async get<T = unknown>(key: SettingKey): Promise<T> {
    return (await this.all())[key] as T;
  }

  async num(key: SettingKey): Promise<number> {
    return Number(await this.get(key));
  }

  async seatMultipliers(): Promise<Record<SeatType, number>> {
    return this.get('pricing.seatMultipliers');
  }

  async update(values: Record<string, unknown>) {
    const keys = Object.keys(values).filter((k) => k in DEFAULT_SETTINGS);
    if (keys.length) await this.repo.save(keys.map((key) => ({ key, value: values[key] })));
    await this.redis.client.del('settings:all');
    return this.all();
  }
}
