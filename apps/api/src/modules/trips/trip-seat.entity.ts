import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { SeatType, TripSeatStatus } from '@bus/types';
import { Trip } from './trip.entity';
import { BusSeat } from '../buses/bus-seat.entity';

@Entity('trip_seats')
@Unique(['tripId', 'number'])
@Index(['tripId', 'status'])
export class TripSeat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tripId: string;

  @ManyToOne(() => Trip, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tripId' })
  trip?: Trip;

  @Column({ type: 'uuid', nullable: true })
  busSeatId: string | null;

  @ManyToOne(() => BusSeat, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'busSeatId' })
  busSeat?: BusSeat | null;

  @Column({ type: 'varchar', length: 10 })
  number: string;

  @Column({ type: 'int' })
  row: number;

  @Column({ type: 'int' })
  column: number;

  @Column({ type: 'varchar', length: 20, default: SeatType.STANDARD })
  type: SeatType;

  @Column({ type: 'varchar', length: 20, default: TripSeatStatus.AVAILABLE })
  status: TripSeatStatus;

  @Column({ type: 'uuid', nullable: true })
  lockedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @Column({ type: 'uuid', nullable: true })
  bookingId: string | null;
}
