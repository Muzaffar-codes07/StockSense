import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { LedgerService } from './ledger.service';
import { integrityQueries } from './ledger.queries';

// Run against a disposable migrated database/schema, like the other db specs.
// Temporary view/constraint changes below are transaction-local and rolled back.
describe('Ledger diagnostics and historical balances (live DB)', () => {
  const prisma = new PrismaClient();
  const ledger = new LedgerService(prisma as never);
  const tag = `LEDGER-${randomUUID()}`;
  const dates = [1, 2, 3, 4].map(
    (day) => new Date(`2020-01-0${day}T12:00:00.000Z`),
  );
  let warehouseId: string;
  let store: string;
  let rack: string;
  let productId: string;
  let archived: string;
  let idle: string;
  let receiptId: string;
  let deliveryId: string;
  let transferId: string;
  let adjustmentId: string;

  const check = (
    result: Awaited<ReturnType<LedgerService['integrity']>>,
    name: string,
  ) => result.checks.find((item) => item.name === name)!;
  const snapshot = (at: Date, id = productId) =>
    ledger.asOf({ at: at.toISOString(), productId: id });
  const move = (data: Partial<Prisma.StockMoveUncheckedCreateInput> = {}) =>
    prisma.stockMove.create({
      data: {
        productId,
        qty: 1,
        moveType: 'RECEIPT',
        toLocationId: store,
        docType: 'receipt',
        docId: receiptId,
        doneAt: dates[0],
        ...data,
      },
    });

  beforeAll(async () => {
    warehouseId = (await prisma.warehouse.create({ data: { name: tag } })).id;
    store = (
      await prisma.location.create({
        data: { name: 'Main Store', warehouseId },
      })
    ).id;
    rack = (
      await prisma.location.create({ data: { name: 'Rack', warehouseId } })
    ).id;
    productId = (
      await prisma.product.create({
        data: { name: 'Steel', sku: `${tag}-steel`, uom: 'kg' },
      })
    ).id;
    archived = (
      await prisma.product.create({
        data: { name: 'Archived', sku: `${tag}-old`, isActive: false },
      })
    ).id;
    idle = (
      await prisma.product.create({
        data: { name: 'Idle', sku: `${tag}-idle` },
      })
    ).id;
    receiptId = (
      await prisma.receipt.create({
        data: {
          status: 'DONE',
          lines: {
            create: [
              { productId, qty: 60 },
              { productId, qty: 40 },
            ],
          },
        },
      })
    ).id;
    transferId = (
      await prisma.transfer.create({
        data: {
          status: 'DONE',
          lines: {
            create: {
              productId,
              qty: 30,
              fromLocationId: store,
              toLocationId: rack,
            },
          },
        },
      })
    ).id;
    deliveryId = (
      await prisma.delivery.create({
        data: {
          status: 'DONE',
          lines: {
            create: {
              productId,
              qty: 20,
            },
          },
        },
      })
    ).id;
    adjustmentId = (
      await prisma.adjustment.create({
        data: {
          status: 'DONE',
          locationId: store,
          lines: {
            create: [
              { productId, recordedQty: 70, countedQty: 67, diff: -3 },
              { productId: idle, recordedQty: 0, countedQty: 0, diff: 0 },
            ],
          },
        },
      })
    ).id;
    await move({ qty: 60 });
    await move({ qty: 40 });
    await move({
      qty: 30,
      moveType: 'INTERNAL',
      fromLocationId: store,
      toLocationId: rack,
      docType: 'transfer',
      docId: transferId,
      doneAt: dates[1],
    });
    await move({
      qty: 20,
      moveType: 'DELIVERY',
      fromLocationId: rack,
      toLocationId: null,
      docType: 'delivery',
      docId: deliveryId,
      doneAt: dates[2],
    });
    await move({
      qty: 3,
      moveType: 'ADJUSTMENT',
      fromLocationId: store,
      toLocationId: null,
      docType: 'adjustment',
      docId: adjustmentId,
      doneAt: dates[3],
    });
    await move({
      productId: archived,
      qty: 0.125,
      moveType: 'ADJUSTMENT',
      docType: 'initial',
      docId: archived,
    });
  });

  afterAll(async () => {
    await prisma.stockMove.deleteMany({
      where: { productId: { in: [productId, archived, idle].filter(Boolean) } },
    });
    if (receiptId) await prisma.receipt.delete({ where: { id: receiptId } });
    if (deliveryId) await prisma.delivery.delete({ where: { id: deliveryId } });
    if (transferId) await prisma.transfer.delete({ where: { id: transferId } });
    if (adjustmentId)
      await prisma.adjustment.delete({ where: { id: adjustmentId } });
    await prisma.product.deleteMany({
      where: { id: { in: [productId, archived, idle].filter(Boolean) } },
    });
    if (warehouseId) {
      await prisma.location.deleteMany({ where: { warehouseId } });
      await prisma.warehouse.delete({ where: { id: warehouseId } });
    }
    await prisma.$disconnect();
  });

  it('accepts multi-line posting, zero-diff adjustment lines, and valid opening stock', async () => {
    const result = await ledger.integrity();
    expect(result.ok).toBe(true);
    expect(
      result.checks.every((item) => item.ok && item.violations.length === 0),
    ).toBe(true);
  });

  it('uses doneAt inclusively and reconstructs the 100 -> 100 -> 80 -> 77 flow', async () => {
    expect((await snapshot(new Date(dates[0].getTime() - 1))).products).toEqual(
      [],
    );
    for (const [index, quantities] of [
      [0, [100]],
      [1, [70, 30]],
      [2, [70, 10]],
      [3, [67, 10]],
    ] as const) {
      const result = await snapshot(dates[index]);
      expect(result.products).toHaveLength(1);
      expect(result.products[0]).toMatchObject({
        productId,
        name: 'Steel',
        sku: `${tag}-steel`,
        uom: 'kg',
      });
      expect(result.products[0].locations.map((loc) => loc.qty)).toEqual(
        quantities,
      );
      expect(result.products[0].locations[0]).toMatchObject({
        locationId: store,
        locationName: 'Main Store',
        warehouseName: tag,
      });
    }
  });

  it('returns all products with prior activity including archived stock; omits idle/unknown products', async () => {
    const all = await ledger.asOf({ at: dates[3].toISOString() });
    expect(all.products.map((p) => p.productId)).toEqual(
      expect.arrayContaining([productId, archived]),
    );
    expect(
      all.products.find((p) => p.productId === archived)?.locations[0].qty,
    ).toBe(0.125);
    expect((await snapshot(dates[3], idle)).products).toEqual([]);
    expect((await snapshot(dates[3], randomUUID())).products).toEqual([]);
  });

  it('retains zero balances and cancels both legs of a same-location move', async () => {
    const drained = await move({
      qty: 10,
      fromLocationId: rack,
      toLocationId: null,
      doneAt: dates[3],
    });
    const loop = await move({
      qty: 7,
      fromLocationId: store,
      toLocationId: store,
      doneAt: dates[3],
    });
    try {
      expect(
        (await snapshot(dates[3])).products[0].locations.map((l) => l.qty),
      ).toEqual([67, 0]);
    } finally {
      await prisma.stockMove.deleteMany({
        where: { id: { in: [drained.id, loop.id] } },
      });
    }
  });

  it.each(['receipt', 'delivery', 'transfer', 'adjustment'])(
    'detects an extra posting for %s',
    async (docType) => {
      const docId = {
        receipt: receiptId,
        delivery: deliveryId,
        transfer: transferId,
        adjustment: adjustmentId,
      }[docType]!;
      const extra = await move({ docType, docId });
      try {
        const result = await ledger.integrity();
        expect(result.ok).toBe(false);
        expect(check(result, 'posted-exactly-once').violations).toContainEqual({
          docType,
          docId,
          expected: docType === 'receipt' ? 2 : 1,
          actual: docType === 'receipt' ? 3 : 2,
        });
        expect(() => JSON.stringify(result)).not.toThrow();
      } finally {
        await prisma.stockMove.delete({ where: { id: extra.id } });
      }
    },
  );

  it('detects a DONE document with no moves', async () => {
    const doc = await prisma.receipt.create({
      data: { status: 'DONE', lines: { create: { productId, qty: 5 } } },
    });
    try {
      expect(
        check(await ledger.integrity(), 'posted-exactly-once').violations,
      ).toContainEqual({
        docType: 'receipt',
        docId: doc.id,
        expected: 1,
        actual: 0,
      });
    } finally {
      await prisma.receipt.delete({ where: { id: doc.id } });
    }
  });

  it('accepts an all-zero adjustment with no moves', async () => {
    const doc = await prisma.adjustment.create({
      data: {
        status: 'DONE',
        locationId: store,
        lines: {
          create: {
            productId,
            recordedQty: 67,
            countedQty: 67,
            diff: 0,
          },
        },
      },
    });
    try {
      expect(check(await ledger.integrity(), 'posted-exactly-once').ok).toBe(
        true,
      );
    } finally {
      await prisma.adjustment.delete({ where: { id: doc.id } });
    }
  });

  it.each(['DRAFT', 'WAITING', 'READY', 'CANCELED'] as const)(
    'flags moves attached to a %s document',
    async (status) => {
      const doc = await prisma.receipt.create({ data: { status } });
      const bad = await move({ docId: doc.id });
      try {
        expect(
          check(await ledger.integrity(), 'no-orphan-moves').violations,
        ).toContainEqual({
          moveId: bad.id,
          docType: 'receipt',
          docId: doc.id,
          documentStatus: status,
        });
      } finally {
        await prisma.stockMove.delete({ where: { id: bad.id } });
        await prisma.receipt.delete({ where: { id: doc.id } });
      }
    },
  );

  it('flags missing, unknown, partially-null and invalid initial provenance', async () => {
    const inputs = [
      { docType: 'receipt', docId: randomUUID() },
      { docType: 'unknown', docId: receiptId },
      { docType: null, docId: null },
      { docType: 'receipt', docId: null },
      { docType: null, docId: receiptId },
      { docType: 'initial', docId: archived },
      { docType: 'initial', docId: null },
    ];
    const bad: { id: string }[] = [];
    try {
      for (const data of inputs) bad.push(await move(data));
      const violations = check(
        await ledger.integrity(),
        'no-orphan-moves',
      ).violations;
      expect(violations.map((v) => v.moveId)).toEqual(
        expect.arrayContaining(bad.map((m) => m.id)),
      );
    } finally {
      await prisma.stockMove.deleteMany({
        where: { id: { in: bad.map((m) => m.id) } },
      });
    }
  });

  it('reports negative balances independently of the view', async () => {
    const bad = await move({
      productId: idle,
      qty: 0.125,
      fromLocationId: store,
      toLocationId: null,
    });
    try {
      expect(
        check(await ledger.integrity(), 'no-negative-stock').violations,
      ).toContainEqual({
        productId: idle,
        locationId: store,
        qty: -0.125,
      });
    } finally {
      await prisma.stockMove.delete({ where: { id: bad.id } });
    }
  });

  it('caps violations at 50 without reporting a pass', async () => {
    const ids = Array.from({ length: 55 }, () => randomUUID());
    try {
      await prisma.stockMove.createMany({
        data: ids.map((id) => ({
          id,
          productId,
          qty: 1,
          moveType: 'RECEIPT' as const,
          toLocationId: store,
          docType: 'receipt',
          docId: randomUUID(),
        })),
      });
      const result = check(await ledger.integrity(), 'no-orphan-moves');
      expect(result.ok).toBe(false);
      expect(result.violations).toHaveLength(50);
    } finally {
      await prisma.stockMove.deleteMany({ where: { id: { in: ids } } });
    }
  });

  // PostgreSQL DDL is transactional: no corruption escapes these tests.
  async function rollbackTest(
    test: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    const rollback = new Error('intentional test rollback');
    try {
      await prisma.$transaction(async (tx) => {
        await test(tx);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  it('detects missing, extra and incorrect view balances', async () => {
    await rollbackTest(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE OR REPLACE VIEW stock_quant AS
        SELECT '${productId}'::text AS product_id, '${store}'::text AS location_id, 999::numeric AS qty
        UNION ALL SELECT '${idle}', '${rack}', 0::numeric`);
      const violations = await tx.$queryRaw<Record<string, unknown>[]>(
        integrityQueries[0].query,
      );
      expect(violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            productId,
            locationId: store,
            ledgerQty: new Prisma.Decimal(67),
            viewQty: new Prisma.Decimal(999),
          }),
          expect.objectContaining({
            productId,
            locationId: rack,
            ledgerQty: new Prisma.Decimal(10),
            viewQty: null,
          }),
          expect.objectContaining({
            productId: idle,
            locationId: rack,
            ledgerQty: null,
            viewQty: new Prisma.Decimal(0),
          }),
        ]),
      );
    });
    expect(check(await ledger.integrity(), 'view-matches-ledger').ok).toBe(
      true,
    );
  });

  it('reports malformed legacy rows even if database checks are absent', async () => {
    await rollbackTest(async (tx) => {
      await tx.$executeRawUnsafe(
        'ALTER TABLE "StockMove" DROP CONSTRAINT "StockMove_qty_positive"',
      );
      await tx.$executeRawUnsafe(
        'ALTER TABLE "StockMove" DROP CONSTRAINT "StockMove_has_location"',
      );
      const ids = [randomUUID(), randomUUID(), randomUUID()];
      await tx.stockMove.createMany({
        data: [
          {
            id: ids[0],
            productId,
            qty: 0,
            moveType: 'RECEIPT',
            toLocationId: store,
          },
          {
            id: ids[1],
            productId,
            qty: -1,
            moveType: 'RECEIPT',
            toLocationId: store,
          },
          { id: ids[2], productId, qty: 1, moveType: 'RECEIPT' },
        ],
      });
      const violations = await tx.$queryRaw<{ moveId: string }[]>(
        integrityQueries[4].query,
      );
      expect(violations.map((v) => v.moveId)).toEqual(
        expect.arrayContaining(ids),
      );
    });
    expect(check(await ledger.integrity(), 'moves-well-formed').ok).toBe(true);
  });
});
