import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Stop } from '../stops/stop.entity';
import { Route } from './route.entity';

@Entity('route_stops')
@Unique(['routeId', 'order'])
@Unique(['routeId', 'stopId'])
export class RouteStop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  routeId: string;

  @ManyToOne(() => Route, (r) => r.stops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routeId' })
  route?: Route;

  @Column({ type: 'uuid' })
  stopId: string;

  @ManyToOne(() => Stop, { eager: true })
  @JoinColumn({ name: 'stopId' })
  stop?: Stop;

  @Column({ type: 'int' })
  order: number;

  @Column({ type: 'int', default: 0 })
  arrivalOffsetMin: number;

  @Column({ type: 'int', default: 0 })
  departureOffsetMin: number;

  @Column({ type: 'double precision', default: 0 })
  distanceFromStartKm: number;
}
