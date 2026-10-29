import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import AppDataSource from '../data-source';
import { Merchant } from '../../modules/merchants/entities/merchant.entity';
import { Store } from '../../modules/stores/entities/store.entity';
import { User } from '../../modules/users/entities/user.entity';
import { Product } from '../../modules/products/entities/product.entity';
import { Inventory } from '../../modules/inventory/entities/inventory.entity';
import { Role } from '../../common/enums/role.enum';

export async function runSeed() {
  const dataSource = await AppDataSource.initialize();

  try {
    const merchantRepo = dataSource.getRepository(Merchant);
    const storeRepo = dataSource.getRepository(Store);
    const userRepo = dataSource.getRepository(User);
    const productRepo = dataSource.getRepository(Product);
    const inventoryRepo = dataSource.getRepository(Inventory);

    await dataSource.query(
      'TRUNCATE TABLE "idempotency_records", "payments", "sale_items", "sales", "inventories", "products", "users", "stores", "merchants" CASCADE;',
    );

    const passwordHash = await bcrypt.hash('Password123!', 10);

    const merchantA = merchantRepo.create({
      name: 'Eastern Retail Ltd.',
      status: 'ACTIVE',
    });
    await merchantRepo.save(merchantA);

    const store1 = storeRepo.create({
      merchantId: merchantA.id,
      name: 'Park Street Flagship, Kolkata',
      address: '18M Park Street, Near Flurys, Kolkata, West Bengal 700016',
    });
    const store2 = storeRepo.create({
      merchantId: merchantA.id,
      name: 'Salt Lake Sector V, Kolkata',
      address:
        'Block EP & GP, Sector V, Bidhannagar, Kolkata, West Bengal 700091',
    });
    await storeRepo.save([store1, store2]);

    const usersA = [
      userRepo.create({
        merchantId: merchantA.id,
        email: 'hasim.ahmed@easternretail.in',
        passwordHash,
        name: 'Hasim Ahmed',
        role: Role.MERCHANT_ADMIN,
      }),
      userRepo.create({
        merchantId: merchantA.id,
        storeId: store1.id,
        email: 'rajesh.sharma@easternretail.in',
        passwordHash,
        name: 'Rajesh Sharma',
        role: Role.STORE_MANAGER,
      }),
      userRepo.create({
        merchantId: merchantA.id,
        storeId: store1.id,
        email: 'arjun.kumar@easternretail.in',
        passwordHash,
        name: 'Arjun Kumar',
        role: Role.CASHIER,
      }),
      userRepo.create({
        merchantId: merchantA.id,
        storeId: store2.id,
        email: 'kavita.patel@easternretail.in',
        passwordHash,
        name: 'Kavita Patel',
        role: Role.CASHIER,
      }),
    ];
    await userRepo.save(usersA);

    const prodA1 = productRepo.create({
      merchantId: merchantA.id,
      sku: 'ERL-TEA-01',
      name: 'Tata Tea Gold Leaf 500g',
      description: 'Rich aroma blended premium Assam black tea',
      price: 245.0,
    });
    const prodA2 = productRepo.create({
      merchantId: merchantA.id,
      sku: 'ERL-RIC-02',
      name: 'Daawat Rozana Basmati Rice 5kg',
      description: 'Aromatic long grain basmati rice',
      price: 425.0,
    });
    const prodA3 = productRepo.create({
      merchantId: merchantA.id,
      sku: 'ERL-BIS-03',
      name: 'Parle-G Gold Biscuits 1kg Pack',
      description: 'Classic glucose biscuits family pack',
      price: 120.0,
    });
    const prodA4 = productRepo.create({
      merchantId: merchantA.id,
      sku: 'ERL-GHE-04',
      name: 'Amul Pure Cow Ghee 1L Tin',
      description: 'Traditional pure cow ghee',
      price: 650.0,
    });
    await productRepo.save([prodA1, prodA2, prodA3, prodA4]);

    const invStore1 = [
      inventoryRepo.create({
        storeId: store1.id,
        productId: prodA1.id,
        quantity: 50,
      }),
      inventoryRepo.create({
        storeId: store1.id,
        productId: prodA2.id,
        quantity: 30,
      }),
      inventoryRepo.create({
        storeId: store1.id,
        productId: prodA3.id,
        quantity: 15,
      }),
      inventoryRepo.create({
        storeId: store1.id,
        productId: prodA4.id,
        quantity: 5,
      }),
    ];

    const invStore2 = [
      inventoryRepo.create({
        storeId: store2.id,
        productId: prodA1.id,
        quantity: 25,
      }),
      inventoryRepo.create({
        storeId: store2.id,
        productId: prodA2.id,
        quantity: 10,
      }),
      inventoryRepo.create({
        storeId: store2.id,
        productId: prodA3.id,
        quantity: 0,
      }),
      inventoryRepo.create({
        storeId: store2.id,
        productId: prodA4.id,
        quantity: 8,
      }),
    ];
    await inventoryRepo.save([...invStore1, ...invStore2]);

    const merchantB = merchantRepo.create({
      name: 'Sagar Provisions & Supermarket',
      status: 'ACTIVE',
    });
    await merchantRepo.save(merchantB);

    const store3 = storeRepo.create({
      merchantId: merchantB.id,
      name: 'Bandra West Outlet, Mumbai',
      address:
        'Hill Road, Near Bandra Station, Bandra West, Mumbai, Maharashtra 400050',
    });
    await storeRepo.save(store3);

    const usersB = [
      userRepo.create({
        merchantId: merchantB.id,
        email: 'amit.deshmukh@sagarprovisions.in',
        passwordHash,
        name: 'Amit Deshmukh',
        role: Role.MERCHANT_ADMIN,
      }),
      userRepo.create({
        merchantId: merchantB.id,
        storeId: store3.id,
        email: 'rohit.verma@sagarprovisions.in',
        passwordHash,
        name: 'Rohit Verma',
        role: Role.CASHIER,
      }),
    ];
    await userRepo.save(usersB);

    const prodB1 = productRepo.create({
      merchantId: merchantB.id,
      sku: 'SGR-MAS-01',
      name: 'MDH Deggi Mirch Red Chilli Powder 100g',
      description: 'Authentic mild spicy red pepper blend',
      price: 85.0,
    });
    const prodB2 = productRepo.create({
      merchantId: merchantB.id,
      sku: 'SGR-DAL-02',
      name: 'Tata Sampann Unpolished Toor Dal 1kg',
      description: 'Natural unpolished protein-rich pigeon peas',
      price: 180.0,
    });
    await productRepo.save([prodB1, prodB2]);

    const invStore3 = [
      inventoryRepo.create({
        storeId: store3.id,
        productId: prodB1.id,
        quantity: 20,
      }),
      inventoryRepo.create({
        storeId: store3.id,
        productId: prodB2.id,
        quantity: 15,
      }),
    ];
    await inventoryRepo.save(invStore3);
  } finally {
    await dataSource.destroy();
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
