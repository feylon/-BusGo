import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
@Index(['createdAt'])
@Index(['action', 'createdAt'])
@Index(['entity', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  eventId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  userRole: string | null;

  @Column({ type: 'varchar', length: 60 })
  action: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  entity: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  method: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  endpoint: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  correlationId: string | null;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}
