import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { TripStatus } from '@bus/types';
import { Route } from '../routes/route.entity';
import { Bus } from '../buses/bus.entity';
import { Driver } from '../drivers/driver.entity';

@Entity('trips')
@Index(['departureAt', 'status'])
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  routeId: string;

  @ManyToOne(() => Route)
  @JoinColumn({ name: 'routeId' })
  route?: Route;

  @Index()
  @Column({ type: 'uuid' })
  busId: string;

  @ManyToOne(() => Bus)
  @JoinColumn({ name: 'busId' })
  bus?: Bus;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  driverId: string | null;

  @ManyToOne(() => Driver, { nullable: true })
  @JoinColumn({ name: 'driverId' })
  driver?: Driver | null;

  @Column({ type: 'timestamptz' })
  departureAt: Date;

  @Column({ type: 'timestamptz' })
  arrivalAt: Date;

  @Column({ type: 'varchar', length: 20, default: TripStatus.SCHEDULED })
  status: TripStatus;

  @Column({ type: 'int' })
  price: number;

  @Column({ type: 'varchar', length: 3, default: 'UZS' })
  currency: string;

  @Column({ type: 'int', default: 0 })
  delayMinutes: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  statusReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  reminderSentAt: Date | null;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
