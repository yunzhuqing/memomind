import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { File } from './File';
import { Note } from './Note';
import { Task } from './Task';
import { Directory } from './Directory';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  password!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 50, default: 'user', nullable: true })
  role?: string;

  @Column({ name: 'team_id', type: 'int', nullable: true })
  teamId?: number;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Using standard imports + arrow functions works for OneToMany because
  // the 'type' of files is File[], which doesn't trigger the metadata circular dependency issue
  // as strongly as the singular side does.
  @OneToMany(() => File, (file) => file.user)
  files?: File[];

  @OneToMany(() => Note, (note) => note.user)
  notes?: Note[];

  @OneToMany(() => Task, (task) => task.user)
  tasks?: Task[];

  @OneToMany(() => Directory, (directory) => directory.user)
  directories?: Directory[];
}
