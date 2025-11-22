import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('files')
export class File {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  @Index()
  userId!: number;

  @Column({ type: 'varchar', length: 255 })
  filename!: string;

  @Column({ name: 'original_filename', type: 'varchar', length: 255 })
  originalFilename!: string;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath!: string;

  @Column({ name: 'file_type', type: 'varchar', length: 100 })
  @Index()
  fileType!: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize!: number;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType?: string;

  @Column({ name: 'directory_path', type: 'varchar', length: 500, default: '/' })
  @Index()
  directoryPath!: string;

  @Column({ name: 'thumbnail_key', type: 'varchar', length: 500, nullable: true })
  thumbnailKey?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne('User', 'files', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: any;
}
