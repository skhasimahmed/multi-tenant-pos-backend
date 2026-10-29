import request from 'supertest';
import { setupTestContext, TestContext } from './helpers/test-helper';
import { Inventory } from '../src/modules/inventory/entities/inventory.entity';

describe('Inventory & Concurrency', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('rejects checkout when requested quantity exceeds available stock', async () => {
    const invRepo = ctx.dataSource.getRepository(Inventory);
    const inv = await invRepo.findOneOrFail({
      where: {
        storeId: ctx.stores.store1.id,
        productId: ctx.products.biscuits.id,
      },
    });
    expect(inv.quantity).toBe(15);

    const res = await request(ctx.app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', `Bearer ${ctx.tokens.cashier1}`)
      .send({
        items: [{ productId: ctx.products.biscuits.id, quantity: 99 }],
        paymentToken: 'mock_token_success',
      })
      .expect(422);

    expect(res.body.message).toContain('Insufficient inventory');

    const checkInv = await invRepo.findOneOrFail({
      where: {
        storeId: ctx.stores.store1.id,
        productId: ctx.products.biscuits.id,
      },
    });
    expect(checkInv.quantity).toBe(15);
  });

  it('prevents overselling during concurrent checkouts', async () => {
    const invRepo = ctx.dataSource.getRepository(Inventory);

    await invRepo.update(
      { storeId: ctx.stores.store1.id, productId: ctx.products.ghee.id },
      { quantity: 4 },
    );

    const req1 = request(ctx.app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', `Bearer ${ctx.tokens.cashier1}`)
      .set('Idempotency-Key', 'concurrent-req-1')
      .send({
        items: [{ productId: ctx.products.ghee.id, quantity: 3 }],
        paymentToken: 'mock_token_success',
      });

    const req2 = request(ctx.app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', `Bearer ${ctx.tokens.cashier1}`)
      .set('Idempotency-Key', 'concurrent-req-2')
      .send({
        items: [{ productId: ctx.products.ghee.id, quantity: 3 }],
        paymentToken: 'mock_token_success',
      });

    const [res1, res2] = await Promise.all([req1, req2]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 422]);

    const finalInv = await invRepo.findOneOrFail({
      where: {
        storeId: ctx.stores.store1.id,
        productId: ctx.products.ghee.id,
      },
    });
    expect(finalInv.quantity).toBe(1);
  });
});
