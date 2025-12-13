import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'user_id' })
  userId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'text', nullable: true })
  usage?: string;

  @Column({ name: 's3_key', type: 'varchar', length: 500, nullable: true })
  s3Key?: string;

  @CreateDateColumn({ name: 'created_time' })
  createdTime!: Date;

  @UpdateDateColumn({ name: 'updated_time' })
  updatedTime!: Date;
}
