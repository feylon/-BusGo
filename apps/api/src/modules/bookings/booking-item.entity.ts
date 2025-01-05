import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from './booking.entity';
import { TripSeat } from '../trips/trip-seat.entity';
import { Passenger } from '../passengers/passenger.entity';

@Entity('booking_items')
@Index('UQ_booking_items_active_seat', ['tripSeatId'], { unique: true, where: '"active" = true' })
export class BookingItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking, (b) => b.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking?: Booking;

  @Column({ type: 'uuid' })
  tripId: string;

  @Column({ type: 'uuid' })
  tripSeatId: string;

  @ManyToOne(() => TripSeat)
  @JoinColumn({ name: 'tripSeatId' })
  seat?: TripSeat;

  @Column({ type: 'uuid' })
  passengerId: string;

  @ManyToOne(() => Passenger, { eager: true })
  @JoinColumn({ name: 'passengerId' })
  passenger?: Passenger;

  @Column({ type: 'varchar', length: 10 })
  seatNumber: string;

  @Column({ type: 'int' })
  price: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
