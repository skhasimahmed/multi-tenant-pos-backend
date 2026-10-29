import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
  Relation,
} from 'typeorm';
import { SaleStatus } from '../../../common/enums/sale-status.enum';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { Store } from '../../stores/entities/store.entity';
import { User } from '../../users/entities/user.entity';
import { SaleItem } from './sale-item.entity';
import { Payment } from '../../payments/entities/payment.entity';

@Entity('sales')
@Index(['storeId', 'createdAt'])
@Index(['merchantId', 'createdAt'])
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  @Index()
  merchantId: string;

  @Column({ name: 'store_id', type: 'uuid' })
  @Index()
  storeId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  @Index()
  idempotencyKey?: string;

  @Column({
    type: 'enum',
    enum: SaleStatus,
    default: SaleStatus.PENDING,
  })
  status: SaleStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Relation<Merchant>;

  @ManyToOne(() => Store, (store) => store.sales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Relation<Store>;

  @ManyToOne(() => User, (user) => user.sales)
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @OneToMany(() => SaleItem, (item) => item.sale, { cascade: true })
  items: Relation<SaleItem[]>;

  @OneToOne(() => Payment, (payment) => payment.sale, { cascade: true })
  payment: Relation<Payment>;
}
