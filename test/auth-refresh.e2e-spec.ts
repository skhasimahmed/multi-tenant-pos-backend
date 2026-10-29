import request from 'supertest';
import { setupTestContext, TestContext } from './helpers/test-helper';

describe('Authentication', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('issues access and refresh tokens on login', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'hasim.ahmed@easternretail.in',
        password: 'Password123!',
      })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('hasim.ahmed@easternretail.in');
    expect(res.body.user.role).toBe('MERCHANT_ADMIN');
  });

  it('rotates refresh token on renewal', async () => {
    const loginRes = await request(ctx.app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'hasim.ahmed@easternretail.in',
        password: 'Password123!',
      })
      .expect(200);

    const refreshRes = await request(ctx.app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(200);

    expect(refreshRes.body.accessToken).toBeDefined();
    expect(refreshRes.body.refreshToken).toBeDefined();

    const authCheck = await request(ctx.app.getHttpServer())
      .get(`/api/inventory/store/${ctx.stores.store1.id}`)
      .set('Authorization', `Bearer ${refreshRes.body.accessToken}`)
      .expect(200);

    expect(Array.isArray(authCheck.body)).toBe(true);
  });

  it('rejects invalid or expired refresh tokens with 401', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid.forged.jwt.token' })
      .expect(401);

    expect(res.body.message).toContain('Invalid or expired refresh token');
  });

  it('revokes active refresh token on logout', async () => {
    const loginRes = await request(ctx.app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'hasim.ahmed@easternretail.in',
        password: 'Password123!',
      })
      .expect(200);

    const { accessToken, refreshToken } = loginRes.body;

    await request(ctx.app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const revokedAttempt = await request(ctx.app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    expect(revokedAttempt.body.message).toContain(
      'Refresh token has been revoked or expired',
    );

    const revokedAccessAttempt = await request(ctx.app.getHttpServer())
      .get(`/api/inventory/store/${ctx.stores.store1.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(revokedAccessAttempt.body.message).toContain(
      'Token has been revoked',
    );
  });
});
