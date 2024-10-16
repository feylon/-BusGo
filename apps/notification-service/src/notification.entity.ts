import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { NotificationType } from '@bus/types';

@Entity('notifications')
@Unique(['eventId', 'userId'])
@Index(['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 40 })
  type: NotificationType;

  @Column({ type: 'jsonb' })
  title: Record<string, string>;

  @Column({ type: 'jsonb' })
  body: Record<string, string>;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  data: Record<string, any>;

  @Column({ type: 'jsonb', default: () => `'["IN_APP"]'` })
  channels: string[];

  @Column({ type: 'uuid', nullable: true })
  eventId: string | null;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
