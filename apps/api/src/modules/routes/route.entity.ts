import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Stop } from '../stops/stop.entity';
import { RouteStop } from './route-stop.entity';

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'uuid' })
  originId: string;

  @ManyToOne(() => Stop)
  @JoinColumn({ name: 'originId' })
  origin?: Stop;

  @Column({ type: 'uuid' })
  destinationId: string;

  @ManyToOne(() => Stop)
  @JoinColumn({ name: 'destinationId' })
  destination?: Stop;

  @Column({ type: 'double precision', default: 0 })
  distanceKm: number;

  @Column({ type: 'int', default: 0 })
  durationMin: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @OneToMany(() => RouteStop, (rs) => rs.route, { cascade: true })
  stops?: RouteStop[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
