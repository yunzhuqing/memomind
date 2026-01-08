import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  @Index()
  userId!: number;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  type!: string; // 'upload', 'torrent', 'download'

  @Column({ type: 'varchar', length: 500 })
  name!: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  @Index()
  status!: string; // 'pending', 'processing', 'completed', 'failed', 'paused'

  @Column({ type: 'int', default: 0 })
  progress!: number; // 0-100

  @Column({ name: 'total_size', type: 'bigint', default: 0 })
  totalSize!: number;

  @Column({ name: 'downloaded_size', type: 'bigint', default: 0 })
  downloadedSize!: number;

  @Column({ name: 'file_path', type: 'text', nullable: true })
  filePath?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;
}
