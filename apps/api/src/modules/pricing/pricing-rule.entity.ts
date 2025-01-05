import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SeatType } from '@bus/types';
import { Route } from '../routes/route.entity';
import { Stop } from '../stops/stop.entity';

@Entity('pricing_rules')
@Index(['routeId', 'fromStopId', 'toStopId'])
export class PricingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  routeId: string;

  @ManyToOne(() => Route, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routeId' })
  route?: Route;

  @Column({ type: 'uuid' })
  fromStopId: string;

  @ManyToOne(() => Stop, { eager: true })
  @JoinColumn({ name: 'fromStopId' })
  fromStop?: Stop;

  @Column({ type: 'uuid' })
  toStopId: string;

  @ManyToOne(() => Stop, { eager: true })
  @JoinColumn({ name: 'toStopId' })
  toStop?: Stop;

  @Column({ type: 'varchar', length: 20, nullable: true })
  seatType: SeatType | null;

  @Column({ type: 'int' })
  price: number;

  @Column({ type: 'varchar', length: 3, default: 'UZS' })
  currency: string;

  @Column({ type: 'timestamptz', nullable: true })
  validFrom: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  validTo: Date | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
