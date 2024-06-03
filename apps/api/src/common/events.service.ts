import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventBus, EventEnvelope, EventHandler } from '@bus/events';
import { env } from '@bus/config';
import { ProcessedEvent } from './processed-event.entity';

@Injectable()
export class EventsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('EventBus');
  readonly bus: EventBus;
  private consumers = 0;

  constructor(private readonly ds: DataSource) {
    this.bus = new EventBus({
      url: env('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),
      service: 'api',
      logger: this.logger,
    });
  }

  async onApplicationBootstrap() {
    if (process.env.EVENTS_DISABLED === 'true') return;
    void this.bus.connect().then(() => (this.consumers ? this.bus.startConsuming() : undefined));
  }

  async onModuleDestroy() {
    await this.bus.close();
  }

  get connected() {
    return this.bus.connected;
  }

  async emit<T>(type: string, payload: T, correlationId?: string) {
    if (process.env.EVENTS_DISABLED === 'true') return;
    try {
      await this.bus.publish(type, payload, { correlationId });
    } catch (err) {
      this.logger.error(`Event ${type} was not published: ${(err as Error).message}`);
    }
  }

  emitLater<T>(type: string, payload: T, correlationId?: string) {
    void this.emit(type, payload, correlationId);
  }

  on<T>(pattern: string, name: string, handler: EventHandler<T>) {
    this.consumers++;
    this.bus.subscribe<T>(pattern, async (event: EventEnvelope<T>) => {
      const repo = this.ds.getRepository(ProcessedEvent);
      if (await repo.exist({ where: { eventId: event.id, handler: name } })) return;
      await handler(event);
      await repo.insert({ eventId: event.id, handler: name }).catch(() => undefined);
    });
  }
}
