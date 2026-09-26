import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MoveType, PrismaClient } from '@prisma/client';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { StockService } from './stock/stock.service';

// End-to-end over HTTP against the live database: the guard on every route,
// auth flows, and the operations paths that unit tests only mock.
describe('HTTP API (live DB)', () => {
  const prisma = new PrismaClient();
  const stock = new StockService(prisma as never);
  const tag = `E${Date.now()}`;
  const email = `${tag.toLowerCase()}@e2e.test`;
  const password = 'correct-horse-1';
  const missing = '00000000-0000-4000-8000-000000000000';

  let app: INestApplication;
  let token: string;
  let warehouseId: string;
  let store: string;
  let shelf: string;
  let productId: string;

  const http = () => request(app.getHttpServer());
  const authed = (method: 'get' | 'post' | 'patch', url: string) =>
    http()[method](url).set('Authorization', `Bearer ${token}`);
  const onHand = (loc = store) => stock.stockOnHand(productId, loc);
  const movesFor = (docId: string) => prisma.stockMove.count({ where: { docId } });

  beforeAll(async () => {
    // This suite makes many auth calls from one IP; the rate limit gets its own test.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();

    const signup = await http()
      .post('/auth/signup')
      .send({ name: 'E2E Tester', email, password })
      .expect(201);
    token = signup.body.accessToken;

    warehouseId = (await prisma.warehouse.create({ data: { name: `${tag} WH` } })).id;
    store = (await prisma.location.create({ data: { warehouseId, name: `${tag} Store` } })).id;
    shelf = (await prisma.location.create({ data: { warehouseId, name: `${tag} Shelf` } })).id;
    productId = (
      await prisma.product.create({ data: { name: `${tag} Steel`, sku: `${tag}-STL` } })
    ).id;
    await stock.postMove({ productId, qty: 10, moveType: MoveType.RECEIPT, toLocationId: store });
  });

  afterAll(async () => {
    await prisma.stockMove.deleteMany({ where: { productId } });
    await prisma.deliveryLine.deleteMany({ where: { productId } });
    await prisma.delivery.deleteMany({ where: { lines: { none: {} } } });
    await prisma.transferLine.deleteMany({ where: { productId } });
    await prisma.transfer.deleteMany({ where: { lines: { none: {} } } });
    await prisma.adjustmentLine.deleteMany({ where: { productId } });
    await prisma.adjustment.deleteMany({ where: { locationId: { in: [store, shelf] } } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.location.deleteMany({ where: { warehouseId } });
    await prisma.warehouse.delete({ where: { id: warehouseId } });
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.passwordResetOtp.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  describe('every non-auth route requires a valid JWT', () => {
    const PUBLIC = new Set([
      'POST /auth/signup',
      'POST /auth/login',
      'POST /auth/request-otp',
      'POST /auth/reset-password',
      'GET /health',
      'GET /meta/enums', // static enum values, public by design
    ]);

    // Read the routes Nest actually registered, so a new unguarded controller fails here.
    const guardedRoutes = () => {
      const stack = app.getHttpAdapter().getInstance()._router.stack as {
        route?: { path: string; methods: Record<string, boolean> };
      }[];
      return stack
        .filter((l) => l.route)
        .flatMap((l) =>
          Object.keys(l.route!.methods).map((m) => ({
            method: m as 'get' | 'post' | 'patch' | 'delete',
            path: l.route!.path.replace(/:[^/]+/g, missing),
          })),
        )
        .filter((r) => !PUBLIC.has(`${r.method.toUpperCase()} ${r.path}`));
    };

    it('finds the app routes (sanity check on the discovery)', () => {
      const paths = guardedRoutes().map((r) => `${r.method.toUpperCase()} ${r.path}`);
      expect(paths).toEqual(
        expect.arrayContaining(['GET /stock', 'GET /products', 'POST /operations/deliveries', 'GET /auth/me']),
      );
      expect(paths.length).toBeGreaterThan(40);
    });

    it('returns 401 without a token', async () => {
      for (const r of guardedRoutes()) {
        const res = await http()[r.method](r.path);
        expect({ route: `${r.method} ${r.path}`, status: res.status }).toEqual({
          route: `${r.method} ${r.path}`,
          status: 401,
        });
      }
    });

    it('returns 401 with a forged token', async () => {
      const forged =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4IiwiZW1haWwiOiJ4QHguY28ifQ.c2lnbmF0dXJlLWZvcmdlZA';
      for (const r of guardedRoutes()) {
        const res = await http()[r.method](r.path).set('Authorization', `Bearer ${forged}`);
        expect({ route: `${r.method} ${r.path}`, status: res.status }).toEqual({
          route: `${r.method} ${r.path}`,
          status: 401,
        });
      }
    });
  });

  describe('auth', () => {
    it('rate-limits login: the 6th attempt in a minute is 429', async () => {
      const limited = configureApp(
        (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication(),
      );
      await limited.init();
      try {
        const statuses: number[] = [];
        for (let i = 0; i < 6; i++) {
          const res = await request(limited.getHttpServer())
            .post('/auth/login')
            .send({ email, password: 'wrong-password' });
          statuses.push(res.status);
        }
        expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
      } finally {
        await limited.close();
      }
    });

    it('signup rejects a duplicate email with 409', async () => {
      await http().post('/auth/signup').send({ name: 'Dup', email, password }).expect(409);
    });

    it('signup rejects a short password with 400', async () => {
      await http()
        .post('/auth/signup')
        .send({ name: 'Short', email: `short-${email}`, password: 'abc' })
        .expect(400);
    });

    it('login rejects a wrong password with 401 and accepts the right one', async () => {
      await http().post('/auth/login').send({ email, password: 'wrong-password' }).expect(401);
      const ok = await http().post('/auth/login').send({ email, password }).expect(201);
      expect(ok.body.accessToken).toEqual(expect.any(String));
    });

    it('GET /auth/me returns the user without the password hash', async () => {
      const me = await authed('get', '/auth/me').expect(200);
      expect(me.body.email).toBe(email);
      expect(me.body).not.toHaveProperty('passwordHash');
    });

    it('rejects an expired reset code, accepts a live one, and burns it after use', async () => {
      const first = await http().post('/auth/request-otp').send({ email }).expect(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      await prisma.passwordResetOtp.updateMany({
        where: { userId: user.id, used: false },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const reset = (otpCode: string, newPassword: string) =>
        http().post('/auth/reset-password').send({ email, otpCode, newPassword });

      await reset(first.body.devOtp, 'new-password-1').expect(400); // expired 1s ago

      const second = await http().post('/auth/request-otp').send({ email }).expect(201);
      await reset(second.body.devOtp, 'new-password-1').expect(201);
      await reset(second.body.devOtp, 'new-password-2').expect(400); // already used
      await http().post('/auth/login').send({ email, password: 'new-password-1' }).expect(201);
      await http().post('/auth/login').send({ email, password }).expect(401);

      // Put the original password back for the other tests.
      const third = await http().post('/auth/request-otp').send({ email }).expect(201);
      await reset(third.body.devOtp, password).expect(201);
    });
  });

  describe('operations validate', () => {
    it('a delivery larger than on-hand fails validation and changes nothing', async () => {
      const d = await authed('post', '/operations/deliveries')
        .send({ lines: [{ productId, qty: 25 }] })
        .expect(201);
      const res = await authed('post', `/operations/deliveries/${d.body.id}/validate`)
        .send({ locationId: store })
        .expect(400);
      expect(res.body.message).toMatch(/Not enough stock .*10 available, 25 requested/);
      expect(await onHand()).toBe(10);
      const after = await authed('get', `/operations/deliveries/${d.body.id}`).expect(200);
      expect(after.body.status).not.toBe('DONE');
      expect(await movesFor(d.body.id)).toBe(0);
    });

    it('a delivery cannot be validated twice', async () => {
      const d = await authed('post', '/operations/deliveries')
        .send({ lines: [{ productId, qty: 2 }] })
        .expect(201);
      const validate = () =>
        authed('post', `/operations/deliveries/${d.body.id}/validate`).send({ locationId: store });
      await validate().expect(201);
      await validate().expect(400);
      expect(await movesFor(d.body.id)).toBe(1);
      expect(await onHand()).toBe(8);
    });

    it('a transfer cannot be validated twice', async () => {
      const t = await authed('post', '/operations/transfers')
        .send({ lines: [{ productId, qty: 3, fromLocationId: store, toLocationId: shelf }] })
        .expect(201);
      await authed('post', `/operations/transfers/${t.body.id}/validate`).expect(201);
      await authed('post', `/operations/transfers/${t.body.id}/validate`).expect(400);
      expect(await movesFor(t.body.id)).toBe(1);
      expect([await onHand(store), await onHand(shelf)]).toEqual([5, 3]);
    });

    it('an adjustment cannot be validated twice', async () => {
      const a = await authed('post', '/operations/adjustments')
        .send({ locationId: shelf, lines: [{ productId, countedQty: 1 }] })
        .expect(201);
      await authed('post', `/operations/adjustments/${a.body.id}/validate`).expect(201);
      await authed('post', `/operations/adjustments/${a.body.id}/validate`).expect(400);
      expect(await movesFor(a.body.id)).toBe(1);
      expect(await onHand(shelf)).toBe(1);
    });
  });

  describe('unknown ids are client errors, never 500', () => {
    it('GET a missing document is 404', async () => {
      for (const kind of ['receipts', 'deliveries', 'transfers', 'adjustments']) {
        await authed('get', `/operations/${kind}/${missing}`).expect(404);
      }
      await authed('get', `/products/${missing}`).expect(404);
    });

    it('creating documents with a missing product is 400', async () => {
      const line = { productId: missing, qty: 1 };
      await authed('post', '/operations/receipts').send({ lines: [line] }).expect(400);
      await authed('post', '/operations/deliveries').send({ lines: [line] }).expect(400);
      await authed('post', '/operations/transfers')
        .send({ lines: [{ ...line, fromLocationId: store, toLocationId: shelf }] })
        .expect(400);
      await authed('post', '/operations/adjustments')
        .send({ locationId: store, lines: [{ productId: missing, countedQty: 1 }] })
        .expect(400);
    });

    it('a missing location is 400 or 404 wherever it is referenced', async () => {
      await authed('post', '/operations/adjustments')
        .send({ locationId: missing, lines: [{ productId, countedQty: 1 }] })
        .expect(404);
      const t = await authed('post', '/operations/transfers').send({
        lines: [{ productId, qty: 1, fromLocationId: missing, toLocationId: shelf }],
      });
      expect([400, 404]).toContain(t.status);

      const d = await authed('post', '/operations/deliveries')
        .send({ lines: [{ productId, qty: 1 }] })
        .expect(201);
      await authed('post', `/operations/deliveries/${d.body.id}/validate`)
        .send({ locationId: missing })
        .expect(404);
    });

    it('a product in a missing category is 400', async () => {
      const res = await authed('post', '/products')
        .send({ name: `${tag} Orphan`, sku: `${tag}-ORPH`, uom: 'unit', unitCost: 1, categoryId: missing })
        .expect(400);
      expect(String(res.body.message)).toMatch(/category/i);
    });
  });
});
