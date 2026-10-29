import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Merchant } from '../modules/merchants/entities/merchant.entity';
import { Store } from '../modules/stores/entities/store.entity';
import { User } from '../modules/users/entities/user.entity';
import { Product } from '../modules/products/entities/product.entity';
import { Inventory } from '../modules/inventory/entities/inventory.entity';
import { Sale } from '../modules/sales/entities/sale.entity';
import { SaleItem } from '../modules/sales/entities/sale-item.entity';
import { Payment } from '../modules/payments/entities/payment.entity';
import { IdempotencyRecord } from '../modules/sales/entities/idempotency-record.entity';
import { InitialSchema1700000000000 } from './migrations/1700000000000-InitialSchema';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'pos_db',
  entities: [
    Merchant,
    Store,
    User,
    Product,
    Inventory,
    Sale,
    SaleItem,
    Payment,
    IdempotencyRecord,
  ],
  migrations: [InitialSchema1700000000000],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
