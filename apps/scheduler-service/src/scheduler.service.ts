import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { InternalClient } from '@bus/shared';
import { env } from '@bus/config';
import { JOBS, JobDef, Target } from './jobs';

const QUEUE = 'scheduler';

@Injectable()
export class SchedulerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  readonly redis = new Redis(env('REDIS_URL', 'redis://localhost:6379'), { maxRetriesPerRequest: null });
  private queue: Queue;
  private worker: Worker;
  private readonly clients: Record<Target, InternalClient>;

  constructor() {
    const token = env('INTERNAL_TOKEN', 'dev-internal-token');
    const make = (name: string, url: string) => new InternalClient({ name, baseURL: url, token, timeoutMs: 30000, retries: 0 });
    this.clients = {
      api: make('api', env('API_URL', 'http://localhost:3000')),
      payment: make('payment-service', env('PAYMENT_SERVICE_URL', 'http://localhost:3105')),
      tracking: make('tracking-service', env('TRACKING_SERVICE_URL', 'http://localhost:3104')),
      notification: make('notification-service', env('NOTIFICATION_SERVICE_URL', 'http://localhost:3101')),
      audit: make('audit-service', env('AUDIT_SERVICE_URL', 'http://localhost:3103')),
      reporting: make('reporting-service', env('REPORTING_SERVICE_URL', 'http://localhost:3107')),
    };
  }

  async onApplicationBootstrap() {
    const connection = this.redis;
    this.queue = new Queue(QUEUE, { connection, defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200, attempts: 3, backoff: { type: 'exponential', delay: 5000 } } });
    const existing = await this.queue.getJobSchedulers();
    for (const s of existing) if (!JOBS.some((j) => j.name === s.key)) await this.queue.removeJobScheduler(s.key);
    for (const job of JOBS) {
      await this.queue.upsertJobScheduler(
        job.name,
        job.every ? { every: job.every } : { pattern: job.cron!, tz: env('SCHEDULER_TZ', 'Asia/Tashkent') },
        { name: job.name, data: {} },
      );
    }
    this.worker = new Worker(QUEUE, (j) => this.process(j), { connection: this.redis.duplicate(), concurrency: 4 });
    this.worker.on('failed', (j, err) => this.logger.warn(`Job ${j?.name} failed: ${err.message}`));
    this.logger.log(`Registered ${JOBS.length} jobs`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    this.redis.disconnect();
  }

  private async process(job: Job) {
    const def = JOBS.find((d) => d.name === job.name);
    if (!def) return;
    const started = Date.now();
    try {
      const results = [];
      for (const call of def.calls) results.push(await this.clients[call.target].post(call.path, {}));
      await this.save(def, { status: 'ok', durationMs: Date.now() - started, result: results.length === 1 ? results[0] : results });
      return results;
    } catch (err) {
      await this.save(def, { status: 'error', durationMs: Date.now() - started, error: (err as any)?.details?.reason ?? (err as Error).message });
      throw err;
    }
  }

  private async save(def: JobDef, run: Record<string, unknown>) {
    const value = JSON.stringify({ ...run, lastRunAt: new Date().toISOString() });
    await this.redis.multi().hset('scheduler:runs', def.name, value).hincrby('scheduler:counts', `${def.name}:${run.status}`, 1).exec();
  }

  async list() {
    const [runs, counts, schedulers] = await Promise.all([
      this.redis.hgetall('scheduler:runs'),
      this.redis.hgetall('scheduler:counts'),
      this.queue.getJobSchedulers(),
    ]);
    return JOBS.map((j) => {
      const s = schedulers.find((x) => x.key === j.name);
      return {
        name: j.name,
        description: j.description,
        schedule: j.every ? `every ${j.every / 1000}s` : j.cron,
        nextRunAt: s?.next ? new Date(s.next).toISOString() : null,
        lastRun: runs[j.name] ? JSON.parse(runs[j.name]) : null,
        ok: Number(counts[`${j.name}:ok`] ?? 0),
        failed: Number(counts[`${j.name}:error`] ?? 0),
      };
    });
  }

  async runNow(name: string) {
    if (!JOBS.some((j) => j.name === name)) return null;
    const job = await this.queue.add(name, {}, { attempts: 1 });
    return { queued: true, id: job.id };
  }
}
