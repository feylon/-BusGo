import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 60, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;
}
