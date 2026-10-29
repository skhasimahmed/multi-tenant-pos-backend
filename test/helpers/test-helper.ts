process.env.NODE_ENV = 'test';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { runSeed } from '../../src/database/seeds/seed';
import { DataSource } from 'typeorm';
import { Store } from '../../src/modules/stores/entities/store.entity';
import { Product } from '../../src/modules/products/entities/product.entity';

export interface TestContext {
  app: INestApplication;
  dataSource: DataSource;
  tokens: {
    cashier1: string;
    cashier3: string;
    manager: string;
    admin: string;
  };
  stores: {
    store1: Store;
    store2: Store;
    store3: Store;
  };
  products: {
    tea: Product;
    rice: Product;
    biscuits: Product;
    ghee: Product;
  };
}

export async function setupTestContext() {
  await runSeed();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  const dataSource = moduleFixture.get(DataSource);

  const storeRepo = dataSource.getRepository(Store);
  const storesList = await storeRepo.find();
  const store1 = storesList.find((s) => s.name.includes('Park Street'))!;
  const store2 = storesList.find((s) => s.name.includes('Salt Lake'))!;
  const store3 = storesList.find((s) => s.name.includes('Bandra'))!;

  const prodRepo = dataSource.getRepository(Product);
  const productsList = await prodRepo.find();
  const tea = productsList.find((p) => p.sku === 'ERL-TEA-01')!;
  const rice = productsList.find((p) => p.sku === 'ERL-RIC-02')!;
  const biscuits = productsList.find((p) => p.sku === 'ERL-BIS-03')!;
  const ghee = productsList.find((p) => p.sku === 'ERL-GHE-04')!;

  const [resCashier1, resCashier3, resAdmin, resManager] = await Promise.all([
    request(app.getHttpServer()).post('/api/auth/login').send({
      email: 'arjun.kumar@easternretail.in',
      password: 'Password123!',
    }),
    request(app.getHttpServer()).post('/api/auth/login').send({
      email: 'rohit.verma@sagarprovisions.in',
      password: 'Password123!',
    }),
    request(app.getHttpServer()).post('/api/auth/login').send({
      email: 'hasim.ahmed@easternretail.in',
      password: 'Password123!',
    }),
    request(app.getHttpServer()).post('/api/auth/login').send({
      email: 'rajesh.sharma@easternretail.in',
      password: 'Password123!',
    }),
  ]);

  return {
    app,
    dataSource,
    tokens: {
      cashier1: resCashier1.body.accessToken,
      cashier3: resCashier3.body.accessToken,
      manager: resManager.body.accessToken,
      admin: resAdmin.body.accessToken,
    },
    stores: { store1, store2, store3 },
    products: { tea, rice, biscuits, ghee },
  };
}
