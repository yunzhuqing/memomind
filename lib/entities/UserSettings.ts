import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_settings')
export class UserSettings {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'int', unique: true })
  @Index()
  userId!: number;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language!: string;

  @Column({ name: 'default_model', type: 'varchar', length: 50, default: 'gpt-4o' })
  defaultModel!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
