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
import { Merchant } from '../../merchants/entities/merchant.entity';
import { User } from '../../users/entities/user.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { Sale } from '../../sales/entities/sale.entity';

@Entity('stores')
@Index(['merchantId', 'name'])
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  @Index()
  merchantId: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Merchant, (merchant) => merchant.stores, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Relation<Merchant>;

  @OneToMany(() => User, (user) => user.store)
  users: Relation<User[]>;

  @OneToMany(() => Inventory, (inventory) => inventory.store)
  inventories: Relation<Inventory[]>;

  @OneToMany(() => Sale, (sale) => sale.store)
  sales: Relation<Sale[]>;
}
