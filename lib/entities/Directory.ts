import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User as UserEntity } from './User';
import type { User } from './User';

@Entity('directories')
@Unique(['userId', 'path'])
export class Directory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  @Index()
  userId!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 500 })
  @Index()
  path!: string;

  @Column({ name: 'parent_path', type: 'varchar', length: 500, default: '/' })
  @Index()
  parentPath!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, (user) => user.directories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
