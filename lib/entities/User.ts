import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import type { File } from './File';
import type { Note } from './Note';
import type { Task } from './Task';
import type { Directory } from './Directory';

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

  @OneToMany(() => require('./File').File, (file: File) => file.user)
  files?: File[];

  @OneToMany(() => require('./Note').Note, (note: Note) => note.user)
  notes?: Note[];

  @OneToMany(() => require('./Task').Task, (task: Task) => task.user)
  tasks?: Task[];

  @OneToMany(() => require('./Directory').Directory, (directory: Directory) => directory.user)
  directories?: Directory[];
}
