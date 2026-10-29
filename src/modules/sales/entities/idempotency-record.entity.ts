import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('idempotency_records')
@Index(['storeId', 'key'], { unique: true })
export class IdempotencyRecord {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  key: string;

  @Column({ name: 'store_id', type: 'uuid' })
  storeId: string;

  @Column({ name: 'status_code', type: 'int' })
  statusCode: number;

  @Column({ name: 'response_body', type: 'text' })
  responseBody: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
