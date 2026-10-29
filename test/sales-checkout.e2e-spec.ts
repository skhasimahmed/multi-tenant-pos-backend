import request from 'supertest';
import { setupTestContext, TestContext } from './helpers/test-helper';
import { Inventory } from '../src/modules/inventory/entities/inventory.entity';

describe('Sales Checkout', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('completes sale and deducts stock when payment succeeds', async () => {
    const invRepo = ctx.dataSource.getRepository(Inventory);
    const initialInv = await invRepo.findOneOrFail({
      where: { storeId: ctx.stores.store1.id, productId: ctx.products.tea.id },
    });
    expect(initialInv.quantity).toBe(50);

    const res = await request(ctx.app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', `Bearer ${ctx.tokens.cashier1}`)
      .send({
        items: [{ productId: ctx.products.tea.id, quantity: 2 }],
        paymentToken: 'mock_token_success',
      })
      .expect(201);

    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.totalAmount).toBe(490.0);
    expect(res.body.payment.status).toBe('SUCCESS');
    expect(res.body.payment.transactionId).toBeDefined();

    const updatedInv = await invRepo.findOneOrFail({
      where: { storeId: ctx.stores.store1.id, productId: ctx.products.tea.id },
    });
    expect(updatedInv.quantity).toBe(48);
  });

  it('aborts sale and keeps stock untouched when payment fails', async () => {
    const invRepo = ctx.dataSource.getRepository(Inventory);
    const beforeInv = await invRepo.findOneOrFail({
      where: { storeId: ctx.stores.store1.id, productId: ctx.products.tea.id },
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', `Bearer ${ctx.tokens.cashier1}`)
      .send({
        items: [{ productId: ctx.products.tea.id, quantity: 2 }],
        paymentToken: 'mock_token_fail_card_declined',
      })
      .expect(400);

    expect(res.body.message).toContain('Payment failed');

    const afterInv = await invRepo.findOneOrFail({
      where: { storeId: ctx.stores.store1.id, productId: ctx.products.tea.id },
    });
    expect(afterInv.quantity).toBe(beforeInv.quantity);
  });
});
