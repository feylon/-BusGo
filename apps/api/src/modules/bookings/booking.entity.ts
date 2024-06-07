import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BookingStatus } from '@bus/types';
import { Trip } from '../trips/trip.entity';
import { User } from '../users/user.entity';
import { Stop } from '../stops/stop.entity';
import { BookingItem } from './booking-item.entity';

@Entity('bookings')
@Index(['status', 'expiresAt'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 12, unique: true })
  code: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Index()
  @Column({ type: 'uuid' })
  tripId: string;

  @ManyToOne(() => Trip)
  @JoinColumn({ name: 'tripId' })
  trip?: Trip;

  @Column({ type: 'uuid' })
  fromStopId: string;

  @ManyToOne(() => Stop)
  @JoinColumn({ name: 'fromStopId' })
  fromStop?: Stop;

  @Column({ type: 'uuid' })
  toStopId: string;

  @ManyToOne(() => Stop)
  @JoinColumn({ name: 'toStopId' })
  toStop?: Stop;

  @Column({ type: 'varchar', length: 20, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Column({ type: 'int' })
  totalAmount: number;

  @Column({ type: 'varchar', length: 3, default: 'UZS' })
  currency: string;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  paymentStatus: string | null;

  @Column({ type: 'varchar', length: 20, default: 'WEB' })
  channel: string;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cancelReason: string | null;

  @OneToMany(() => BookingItem, (i) => i.booking, { cascade: true })
  items?: BookingItem[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
