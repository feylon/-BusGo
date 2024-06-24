import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BusLayout, BusStatus } from '@bus/types';
import { BusSeat } from './bus-seat.entity';

@Entity('buses')
export class Bus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  model: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  plateNumber: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  busNumber: string | null;

  @Column({ type: 'int', default: 0 })
  capacity: number;

  @Column({ type: 'jsonb', default: () => `'{"rows":0,"cols":0,"cells":[]}'` })
  layout: BusLayout;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  amenities: string[];

  @Column({ type: 'varchar', length: 20, default: BusStatus.ACTIVE })
  status: BusStatus;

  @OneToMany(() => BusSeat, (s) => s.bus)
  seats?: BusSeat[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
