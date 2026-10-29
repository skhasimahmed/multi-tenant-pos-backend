import request from 'supertest';
import { setupTestContext, TestContext } from './helpers/test-helper';

describe('Tenant Isolation', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('blocks cashier from creating sales in another store', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', `Bearer ${ctx.tokens.cashier1}`)
      .send({
        storeId: ctx.stores.store2.id,
        items: [{ productId: ctx.products.tea.id, quantity: 1 }],
      })
      .expect(403);

    expect(res.body.message).toContain(
      'cannot access resources of another store',
    );
  });

  it('blocks cashier from viewing inventory of another store', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/inventory/store/${ctx.stores.store3.id}`)
      .set('Authorization', `Bearer ${ctx.tokens.cashier1}`)
      .expect(403);

    expect(res.body.message).toContain(
      'cannot access resources of another store',
    );
  });

  it('blocks user from viewing products of another merchant', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/products/${ctx.products.tea.id}`)
      .set('Authorization', `Bearer ${ctx.tokens.cashier3}`)
      .expect(404);

    expect(res.body.message).toContain('Product not found');
  });

  it('allows merchant admin to update stock and access all stores in their merchant', async () => {
    const res1 = await request(ctx.app.getHttpServer())
      .get(`/api/inventory/store/${ctx.stores.store1.id}`)
      .set('Authorization', `Bearer ${ctx.tokens.admin}`)
      .expect(200);

    const res2 = await request(ctx.app.getHttpServer())
      .get(`/api/inventory/store/${ctx.stores.store2.id}`)
      .set('Authorization', `Bearer ${ctx.tokens.admin}`)
      .expect(200);

    expect(Array.isArray(res1.body)).toBe(true);
    expect(Array.isArray(res2.body)).toBe(true);

    const updateRes = await request(ctx.app.getHttpServer())
      .put(
        `/api/inventory/store/${ctx.stores.store2.id}/product/${ctx.products.tea.id}`,
      )
      .set('Authorization', `Bearer ${ctx.tokens.admin}`)
      .send({ quantity: 45 })
      .expect(200);

    expect(updateRes.body.quantity).toBe(45);
  });

  it('blocks merchant admin from updating stock or creating sales in another merchant store', async () => {
    const updateAttempt = await request(ctx.app.getHttpServer())
      .put(
        `/api/inventory/store/${ctx.stores.store3.id}/product/${ctx.products.tea.id}`,
      )
      .set('Authorization', `Bearer ${ctx.tokens.admin}`)
      .send({ quantity: 100 })
      .expect(404);

    expect(updateAttempt.body.message).toContain(
      'Store not found for this merchant',
    );

    const saleAttempt = await request(ctx.app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', `Bearer ${ctx.tokens.admin}`)
      .send({
        storeId: ctx.stores.store3.id,
        items: [{ productId: ctx.products.tea.id, quantity: 1 }],
      })
      .expect(404);

    expect(saleAttempt.body.message).toContain(
      'Store not found for this merchant',
    );
  });

  it('allows store manager to view inventory for assigned store', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/inventory/store/${ctx.stores.store1.id}`)
      .set('Authorization', `Bearer ${ctx.tokens.manager}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });
});
