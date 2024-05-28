import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EventBus, EventHandler } from '@bus/events';

@Injectable()
export class ServiceBus implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger: Logger;
  readonly bus: EventBus;
  private handlers = 0;

  constructor(service: string) {
    this.logger = new Logger(`EventBus:${service}`);
    this.bus = new EventBus({
      url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
      service,
      logger: this.logger,
      maxRetries: Number(process.env.EVENT_MAX_RETRIES) || 5,
    });
  }

  on<T>(pattern: string, handler: EventHandler<T>) {
    this.handlers++;
    this.bus.subscribe(pattern, handler);
  }

  async onApplicationBootstrap() {
    await this.bus.connect();
    if (this.handlers) await this.bus.startConsuming();
  }

  async onModuleDestroy() {
    await this.bus.close();
  }

  get connected() {
    return this.bus.connected;
  }

  async emit<T>(type: string, payload: T, correlationId?: string) {
    try {
      await this.bus.publish(type, payload, { correlationId });
    } catch (err) {
      this.logger.error(`Event ${type} was not published: ${(err as Error).message}`);
    }
  }
}
