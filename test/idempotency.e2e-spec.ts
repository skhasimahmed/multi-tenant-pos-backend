import request from 'supertest';
import { setupTestContext, TestContext } from './helpers/test-helper';
import { Inventory } from '../src/modules/inventory/entities/inventory.entity';

describe('Idempotency', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('returns original sale without deducting stock again on retry', async () => {
    const idempotencyKey = 'pos-terminal-retry-uuid-999';
    const invRepo = ctx.dataSource.getRepository(Inventory);

    const initialInv = await invRepo.findOneOrFail({
      where: { storeId: ctx.stores.store1.id, productId: ctx.products.ghee.id },
    });
    const startingStock = initialInv.quantity;

    const firstRes = await request(ctx.app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', `Bearer ${ctx.tokens.cashier1}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        items: [{ productId: ctx.products.ghee.id, quantity: 1 }],
        paymentToken: 'mock_token_success',
      })
      .expect(201);

    const firstSaleId = firstRes.body.id;
    expect(firstSaleId).toBeDefined();

    const midInv = await invRepo.findOneOrFail({
      where: { storeId: ctx.stores.store1.id, productId: ctx.products.ghee.id },
    });
    expect(midInv.quantity).toBe(startingStock - 1);

    const retryRes = await request(ctx.app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', `Bearer ${ctx.tokens.cashier1}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        items: [{ productId: ctx.products.ghee.id, quantity: 1 }],
        paymentToken: 'mock_token_success',
      })
      .expect(201);

    expect(retryRes.body.id).toBe(firstSaleId);
    expect(retryRes.body.totalAmount).toBe(firstRes.body.totalAmount);

    const finalInv = await invRepo.findOneOrFail({
      where: { storeId: ctx.stores.store1.id, productId: ctx.products.ghee.id },
    });
    expect(finalInv.quantity).toBe(startingStock - 1);
  });
});
