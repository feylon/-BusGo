import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TicketStatus } from '@bus/types';
import { Booking } from '../bookings/booking.entity';
import { Passenger } from '../passengers/passenger.entity';
import { Trip } from '../trips/trip.entity';
import { TripSeat } from '../trips/trip-seat.entity';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  ticketNumber: string;

  @Index()
  @Column({ type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking?: Booking;

  @Column({ type: 'uuid', unique: true })
  bookingItemId: string;

  @Column({ type: 'uuid' })
  passengerId: string;

  @ManyToOne(() => Passenger, { eager: true })
  @JoinColumn({ name: 'passengerId' })
  passenger?: Passenger;

  @Index()
  @Column({ type: 'uuid' })
  tripId: string;

  @ManyToOne(() => Trip)
  @JoinColumn({ name: 'tripId' })
  trip?: Trip;

  @Column({ type: 'uuid' })
  seatId: string;

  @ManyToOne(() => TripSeat)
  @JoinColumn({ name: 'seatId' })
  seat?: TripSeat;

  @Column({ type: 'varchar', length: 10 })
  seatNumber: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  qrToken: string;

  @Column({ type: 'varchar', length: 20, default: TicketStatus.ACTIVE })
  status: TicketStatus;

  @Column({ type: 'int' })
  price: number;

  @Column({ type: 'timestamptz' })
  issuedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  verifiedBy: string | null;
}
