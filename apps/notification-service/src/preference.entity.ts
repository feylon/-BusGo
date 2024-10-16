import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('notification_preferences')
export class Preference {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @Column({ type: 'jsonb', default: () => `'["IN_APP","PUSH"]'` })
  channels: string[];

  @Column({ type: 'jsonb', default: () => `'[]'` })
  muted: string[];

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
