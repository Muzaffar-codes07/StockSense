import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { configureApp } from '../app.setup';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';

describe('Ledger HTTP validation and authentication', () => {
  let app: INestApplication;
  let token: string;
  const queryRaw = jest.fn().mockResolvedValue([]);
  const transaction = jest.fn((queries: Promise<unknown>[]) =>
    Promise.all(queries),
  );
  const secret = 'ledger-unit-test-secret';
  let previousSecret: string | undefined;

  beforeAll(async () => {
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret })],
      controllers: [LedgerController],
      providers: [
        LedgerService,
        JwtAuthGuard,
        {
          provide: PrismaService,
          useValue: { $queryRaw: queryRaw, $transaction: transaction },
        },
      ],
    }).compile();
    app = configureApp(module.createNestApplication());
    await app.init();
    token = module.get(JwtService).sign({ sub: 'test-user', role: 'STAFF' });
  });

  afterAll(async () => {
    await app.close();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  beforeEach(() => jest.clearAllMocks());

  it.each(['/ledger/integrity', '/ledger/as-of?at=2020-01-01T00:00:00Z'])(
    'requires a valid JWT for %s',
    async (url) => {
      await request(app.getHttpServer()).get(url).expect(401);
      await request(app.getHttpServer())
        .get(url)
        .set('Authorization', 'Bearer invalid')
        .expect(401);
      expect(queryRaw).not.toHaveBeenCalled();
    },
  );

  it.each([
    {},
    { at: '' },
    { at: 'yesterday' },
    { at: '2020-02-30T00:00:00Z' },
    { at: '2020-01-01' },
    { at: '2020-01-01T00:00:00' },
    { at: '2999-01-01T00:00:00Z' },
    { at: '2020-01-01T00:00:00Z', productId: 'bad-id' },
    { at: '2020-01-01T00:00:00Z', extra: 'no' },
    { at: ['2020-01-01T00:00:00Z', '2020-01-02T00:00:00Z'] },
  ])(
    'rejects invalid as-of query %j before reading the ledger',
    async (query) => {
      await request(app.getHttpServer())
        .get('/ledger/as-of')
        .set('Authorization', `Bearer ${token}`)
        .query(query)
        .expect(400);
      expect(queryRaw).not.toHaveBeenCalled();
    },
  );

  it('normalizes a timezone offset and returns an empty snapshot for no activity', async () => {
    const result = await request(app.getHttpServer())
      .get('/ledger/as-of')
      .set('Authorization', `Bearer ${token}`)
      .query({
        at: '2020-01-01T05:30:00+05:30',
        productId: '00000000-0000-4000-8000-000000000000',
      })
      .expect(200);
    expect(result.body).toEqual({
      at: '2020-01-01T00:00:00.000Z',
      products: [],
    });
  });

  it('returns all five passing checks for authenticated staff', async () => {
    const result = await request(app.getHttpServer())
      .get('/ledger/integrity')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.checks).toHaveLength(5);
    expect(
      result.body.checks.every(
        (check: { ok: boolean; violations: unknown[] }) =>
          check.ok && check.violations.length === 0,
      ),
    ).toBe(true);
    expect(Number.isFinite(Date.parse(result.body.checkedAt))).toBe(true);
    expect(transaction).toHaveBeenCalledWith(expect.any(Array), {
      isolationLevel: 'RepeatableRead',
    });
  });
});
