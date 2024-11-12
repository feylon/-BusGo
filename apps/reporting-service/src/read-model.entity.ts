import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('report_bookings')
@Index(['confirmedAt'])
@Index(['routeId', 'confirmedAt'])
export class ReportBooking {
  @PrimaryColumn({ type: 'uuid' })
  bookingId: string;

  @Column({ type: 'varchar', length: 12 })
  code: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Index()
  @Column({ type: 'uuid' })
  tripId: string;

  @Column({ type: 'uuid' })
  routeId: string;

  @Column({ type: 'varchar', length: 150 })
  routeName: string;

  @Column({ type: 'uuid', nullable: true })
  busId: string | null;

  @Column({ type: 'uuid', nullable: true })
  driverId: string | null;

  @Column({ type: 'int', default: 0 })
  amount: number;

  @Column({ type: 'int', default: 0 })
  seats: number;

  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  cancelReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  departureAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;
}

@Entity('report_trips')
@Index(['departureAt'])
export class ReportTrip {
  @PrimaryColumn({ type: 'uuid' })
  tripId: string;

  @Index()
  @Column({ type: 'uuid' })
  routeId: string;

  @Column({ type: 'varchar', length: 150 })
  routeName: string;

  @Index()
  @Column({ type: 'uuid' })
  busId: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  busPlate: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  driverId: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  driverName: string | null;

  @Column({ type: 'int', default: 0 })
  capacity: number;

  @Column({ type: 'int', default: 0 })
  soldSeats: number;

  @Column({ type: 'int', default: 0 })
  revenue: number;

  @Column({ type: 'int', default: 0 })
  delayMinutes: number;

  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: 'timestamptz' })
  departureAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  arrivalAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}

@Entity('report_payments')
@Index(['occurredAt'])
export class ReportPayment {
  @PrimaryColumn({ type: 'uuid' })
  paymentId: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: 'varchar', length: 20 })
  provider: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  reason: string | null;

  @Column({ type: 'timestamptz' })
  occurredAt: Date;
}

@Entity('daily_summaries')
export class DailySummary {
  @PrimaryColumn({ type: 'date' })
  date: string;

  @Column({ type: 'int', default: 0 })
  bookings: number;

  @Column({ type: 'int', default: 0 })
  tickets: number;

  @Column({ type: 'bigint', default: 0 })
  revenue: string;

  @Column({ type: 'int', default: 0 })
  cancelled: number;

  @Column({ type: 'int', default: 0 })
  trips: number;

  @Column({ type: 'int', default: 0 })
  passengers: number;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  details: Record<string, any>;

  @Column({ type: 'timestamptz' })
  generatedAt: Date;
}
