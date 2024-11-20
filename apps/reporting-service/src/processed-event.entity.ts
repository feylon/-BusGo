import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('processed_events')
export class ProcessedEvent {
  @PrimaryColumn({ type: 'uuid' })
  eventId: string;

  @PrimaryColumn({ type: 'varchar', length: 60 })
  handler: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
