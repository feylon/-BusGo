import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('location_history')
@Index(['tripId', 'recordedAt'])
export class LocationHistory {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'uuid' })
  tripId: string;

  @Index()
  @Column({ type: 'uuid' })
  vehicleId: string;

  @Column({ type: 'uuid' })
  driverId: string;

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column({ type: 'real', default: 0 })
  speed: number;

  @Column({ type: 'real', default: 0 })
  heading: number;

  @Column({ type: 'real', default: 0 })
  accuracy: number;

  @Column({ type: 'timestamptz' })
  recordedAt: Date;
}
