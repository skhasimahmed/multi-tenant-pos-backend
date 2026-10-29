import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Relation,
} from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { Store } from '../../stores/entities/store.entity';
import { Sale } from '../../sales/entities/sale.entity';

@Entity('users')
@Index(['email'], { unique: true })
@Index(['merchantId', 'storeId'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  @Index()
  merchantId: string;

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  @Index()
  storeId?: string;

  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.CASHIER,
  })
  role: Role;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Merchant, (merchant) => merchant.users, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Relation<Merchant>;

  @ManyToOne(() => Store, (store) => store.users, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'store_id' })
  store?: Relation<Store>;

  @OneToMany(() => Sale, (sale) => sale.user)
  sales: Relation<Sale[]>;
}
