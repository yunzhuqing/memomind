import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

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

  @OneToMany('File', (file: any) => file.user)
  files?: any[];

  @OneToMany('Note', (note: any) => note.user)
  notes?: any[];

  @OneToMany('Task', (task: any) => task.user)
  tasks?: any[];

  @OneToMany('Directory', (directory: any) => directory.user)
  directories?: any[];
}
