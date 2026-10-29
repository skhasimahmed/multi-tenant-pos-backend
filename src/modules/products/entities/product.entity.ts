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
  Unique,
  Relation,
} from 'typeorm';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { SaleItem } from '../../sales/entities/sale-item.entity';

@Entity('products')
@Unique(['merchantId', 'sku'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  @Index()
  merchantId: string;

  @Column({ type: 'varchar', length: 64 })
  sku: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Merchant, (merchant) => merchant.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Relation<Merchant>;

  @OneToMany(() => Inventory, (inventory) => inventory.product)
  inventories: Relation<Inventory[]>;

  @OneToMany(() => SaleItem, (item) => item.product)
  saleItems: Relation<SaleItem[]>;
}
