import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '@bus/config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;
  readonly subscriber: Redis;

  constructor() {
    const url = env('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(url, { maxRetriesPerRequest: 3 });
    this.subscriber = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: true });
    this.client.on('error', (e) => this.logger.error(`Redis error: ${e.message}`));
    this.subscriber.on('error', (e) => this.logger.error(`Redis subscriber error: ${e.message}`));
  }

  async ping() {
    return (await this.client.ping()) === 'PONG';
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSec?: number) {
    const raw = JSON.stringify(value);
    if (ttlSec) await this.client.set(key, raw, 'EX', ttlSec);
    else await this.client.set(key, raw);
  }

  async onModuleDestroy() {
    this.client.disconnect();
    this.subscriber.disconnect();
  }
}
