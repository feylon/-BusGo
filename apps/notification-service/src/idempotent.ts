import { DataSource, EntityManager } from 'typeorm';
import { EventEnvelope } from '@bus/events';

export function idempotent<T>(ds: DataSource, handler: string, fn: (e: EventEnvelope<T>, m: EntityManager) => Promise<void>) {
  return (e: EventEnvelope<T>) =>
    ds.transaction(async (m) => {
      const rows = await m.query(
        `INSERT INTO processed_events ("eventId", "handler") VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING "eventId"`,
        [e.id, handler],
      );
      if (!rows.length) return;
      await fn(e, m);
    });
}
