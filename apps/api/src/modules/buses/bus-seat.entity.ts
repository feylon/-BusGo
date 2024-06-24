import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BusSeatStatus, SeatPosition, SeatType } from '@bus/types';
import { Bus } from './bus.entity';

@Entity('bus_seats')
@Unique(['busId', 'number'])
@Unique(['busId', 'row', 'column'])
export class BusSeat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  busId: string;

  @ManyToOne(() => Bus, (b) => b.seats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'busId' })
  bus?: Bus;

  @Column({ type: 'varchar', length: 10 })
  number: string;

  @Column({ type: 'int' })
  row: number;

  @Column({ type: 'int' })
  column: number;

  @Column({ type: 'varchar', length: 20, default: SeatType.STANDARD })
  type: SeatType;

  @Column({ type: 'varchar', length: 20, default: SeatPosition.AISLE })
  position: SeatPosition;

  @Column({ type: 'varchar', length: 20, default: BusSeatStatus.ACTIVE })
  status: BusSeatStatus;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata: Record<string, any>;
}
