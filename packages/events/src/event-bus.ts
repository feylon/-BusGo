import { randomUUID } from 'node:crypto';
import * as amqp from 'amqplib';
import { EVENTS_EXCHANGE, EventEnvelope } from './contracts';

export type EventHandler<T = any> = (event: EventEnvelope<T>) => Promise<void>;

export interface Logger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string, trace?: string): void;
}

export interface EventBusOptions {
  url: string;
  service: string;
  prefetch?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  logger?: Logger;
}

interface Subscription {
  pattern: string;
  handler: EventHandler;
}

const consoleLogger: Logger = {
  log: (m) => console.log(m),
  warn: (m) => console.warn(m),
  error: (m, t) => console.error(m, t ?? ''),
};

export class EventBus {
  private conn: amqp.ChannelModel | null = null;
  private pubChannel: amqp.ConfirmChannel | null = null;
  private subChannel: amqp.Channel | null = null;
  private subs: Subscription[] = [];
  private consuming = false;
  private closing = false;
  private connecting: Promise<void> | null = null;
  private readonly log: Logger;

  constructor(private readonly opts: EventBusOptions) {
    this.log = opts.logger ?? consoleLogger;
  }

  get connected() {
    return !!this.conn && !!this.pubChannel;
  }

  get queue() {
    return `${this.opts.service}.events`;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (!this.connecting) {
      this.connecting = this.connectWithRetry().finally(() => (this.connecting = null));
    }
    return this.connecting;
  }

  private async connectWithRetry() {
    let attempt = 0;
    while (!this.closing) {
      try {
        await this.open();
        this.log.log(`RabbitMQ connected (${this.opts.service})`);
        return;
      } catch (err) {
        attempt++;
        const wait = Math.min(1000 * 2 ** Math.min(attempt, 5), 30000);
        this.log.warn(`RabbitMQ connection failed (${(err as Error).message}), retry in ${wait}ms`);
        await sleep(wait);
      }
    }
  }

  private async open() {
    const conn = await amqp.connect(this.opts.url);
    conn.on('error', (err) => this.log.error(`RabbitMQ error: ${err.message}`));
    conn.on('close', () => {
      this.conn = null;
      this.pubChannel = null;
      this.subChannel = null;
      if (!this.closing) {
        this.log.warn('RabbitMQ connection closed, reconnecting');
        this.connect()
          .then(() => (this.consuming ? this.startConsuming() : undefined))
          .catch((e) => this.log.error(`RabbitMQ reconnect failed: ${e.message}`));
      }
    });
    const pub = await conn.createConfirmChannel();
    await pub.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    this.conn = conn;
    this.pubChannel = pub;
  }

  async publish<T>(type: string, payload: T, meta: { correlationId?: string; id?: string } = {}) {
    const event: EventEnvelope<T> = {
      id: meta.id ?? randomUUID(),
      type,
      source: this.opts.service,
      correlationId: meta.correlationId ?? randomUUID(),
      occurredAt: new Date().toISOString(),
      payload,
    };
    let lastErr: unknown;
    for (let i = 0; i < 3; i++) {
      try {
        if (!this.connected) await withTimeout(this.connect(), 5000);
        await this.send(type, event);
        return event;
      } catch (err) {
        lastErr = err;
        await sleep(300 * (i + 1));
      }
    }
    this.log.error(`Failed to publish ${type}: ${(lastErr as Error)?.message}`);
    throw lastErr;
  }

  private send(routingKey: string, event: EventEnvelope) {
    const ch = this.pubChannel!;
    return new Promise<void>((resolve, reject) => {
      ch.publish(
        EVENTS_EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify(event)),
        {
          persistent: true,
          contentType: 'application/json',
          messageId: event.id,
          correlationId: event.correlationId,
          type: event.type,
          headers: { 'x-retry-count': 0 },
        },
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }

  subscribe<T = any>(pattern: string, handler: EventHandler<T>) {
    this.subs.push({ pattern, handler });
  }

  async startConsuming() {
    this.consuming = true;
    await this.connect();
    const conn = this.conn!;
    const ch = await conn.createChannel();
    this.subChannel = ch;
    const queue = this.queue;
    const retryQueue = `${this.opts.service}.retry`;
    const dlq = `${this.opts.service}.dlq`;
    await ch.assertQueue(dlq, { durable: true });
    await ch.assertQueue(retryQueue, {
      durable: true,
      arguments: {
        'x-message-ttl': this.opts.retryDelayMs ?? 5000,
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': queue,
      },
    });
    await ch.assertQueue(queue, { durable: true });
    for (const pattern of new Set(this.subs.map((s) => s.pattern))) {
      await ch.bindQueue(queue, EVENTS_EXCHANGE, pattern);
    }
    await ch.prefetch(this.opts.prefetch ?? 20);
    await ch.consume(queue, (msg) => {
      if (msg) void this.handle(ch, msg, retryQueue, dlq);
    });
    this.log.log(`Consuming ${queue}: ${this.subs.map((s) => s.pattern).join(', ')}`);
  }

  private async handle(ch: amqp.Channel, msg: amqp.ConsumeMessage, retryQueue: string, dlq: string) {
    const key = msg.fields.routingKey;
    let event: EventEnvelope;
    try {
      event = JSON.parse(msg.content.toString());
    } catch {
      ch.sendToQueue(dlq, msg.content, { persistent: true, headers: { 'x-error': 'invalid json' } });
      ch.ack(msg);
      return;
    }
    const handlers = this.subs.filter((s) => matches(s.pattern, event.type || key));
    try {
      for (const h of handlers) await h.handler(event);
      ch.ack(msg);
    } catch (err) {
      const retries = Number(msg.properties.headers?.['x-retry-count'] ?? 0);
      const max = this.opts.maxRetries ?? 5;
      const error = (err as Error).message;
      const props = {
        persistent: true,
        contentType: 'application/json',
        messageId: msg.properties.messageId,
        correlationId: msg.properties.correlationId,
        type: msg.properties.type,
        headers: { 'x-retry-count': retries + 1, 'x-error': error, 'x-routing-key': key },
      };
      if (retries < max) {
        this.log.warn(`Handler failed for ${event.type} (${event.id}), retry ${retries + 1}/${max}: ${error}`);
        ch.sendToQueue(retryQueue, msg.content, props);
      } else {
        this.log.error(`Event ${event.type} (${event.id}) moved to DLQ: ${error}`);
        ch.sendToQueue(dlq, msg.content, props);
      }
      ch.ack(msg);
    }
  }

  async close() {
    this.closing = true;
    try {
      await this.subChannel?.close();
      await this.pubChannel?.close();
      await this.conn?.close();
    } catch {
      return;
    }
  }
}

export function matches(pattern: string, key: string) {
  if (pattern === key || pattern === '#') return true;
  const p = pattern.split('.');
  const k = key.split('.');
  const walk = (i: number, j: number): boolean => {
    if (i === p.length) return j === k.length;
    if (p[i] === '#') {
      for (let n = j; n <= k.length; n++) if (walk(i + 1, n)) return true;
      return false;
    }
    if (j === k.length) return false;
    return (p[i] === '*' || p[i] === k[j]) && walk(i + 1, j + 1);
  };
  return walk(0, 0);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('RabbitMQ connect timeout')), ms))]);
}
