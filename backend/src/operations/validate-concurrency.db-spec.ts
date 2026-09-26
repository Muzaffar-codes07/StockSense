import { BadRequestException } from '@nestjs/common';
import { DocStatus, MoveType, PrismaClient } from '@prisma/client';
import { StockService } from '../stock/stock.service';
import { AdjustmentsService } from './adjustments.service';
import { DeliveriesService } from './deliveries.service';
import { ReceiptsService } from './receipts.service';
import { TransfersService } from './transfers.service';

// Issue #16: a document must post its moves exactly once, however many
// validate() calls race for it, and PATCH must never mark it DONE.
describe('operation documents post exactly once (live DB)', () => {
  const prisma = new PrismaClient();
  const stock = new StockService(prisma as never);
  const receipts = new ReceiptsService(prisma as never, stock);
  const deliveries = new DeliveriesService(prisma as never, stock);
  const transfers = new TransfersService(prisma as never, stock);
  const adjustments = new AdjustmentsService(prisma as never, stock);
  const tag = `C${Date.now()}`;
  const RACERS = 5;
  let warehouseId: string;
  let store: string;
  let shelf: string;
  let steel: string;
  let bolts: string;

  const movesFor = (docId: string) => prisma.stockMove.count({ where: { docId } });
  const race = (validate: () => Promise<unknown>) =>
    Promise.allSettled(Array.from({ length: RACERS }, validate));
  const expectOneWinner = (results: PromiseSettledResult<unknown>[]) => {
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of results.filter((r) => r.status === 'rejected')) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(BadRequestException);
    }
  };

  beforeAll(async () => {
    warehouseId = (await prisma.warehouse.create({ data: { name: `${tag} WH` } })).id;
    store = (await prisma.location.create({ data: { warehouseId, name: `${tag} Store` } })).id;
    shelf = (await prisma.location.create({ data: { warehouseId, name: `${tag} Shelf` } })).id;
    steel = (await prisma.product.create({ data: { name: `${tag} Steel`, sku: `${tag}-STL` } })).id;
    bolts = (await prisma.product.create({ data: { name: `${tag} Bolts`, sku: `${tag}-BLT` } })).id;
    for (const productId of [steel, bolts]) {
      await stock.postMove({ productId, qty: 100, moveType: MoveType.RECEIPT, toLocationId: store });
    }
  });

  afterAll(async () => {
    const products = { productId: { in: [steel, bolts] } };
    await prisma.stockMove.deleteMany({ where: products });
    for (const line of ['receiptLine', 'deliveryLine', 'transferLine', 'adjustmentLine'] as const) {
      await (prisma[line] as unknown as { deleteMany: (a: object) => Promise<unknown> }).deleteMany({ where: products });
    }
    await prisma.receipt.deleteMany({ where: { lines: { none: {} } } });
    await prisma.delivery.deleteMany({ where: { lines: { none: {} } } });
    await prisma.transfer.deleteMany({ where: { lines: { none: {} } } });
    await prisma.adjustment.deleteMany({ where: { locationId: { in: [store, shelf] } } });
    await prisma.product.deleteMany({ where: { id: { in: [steel, bolts] } } });
    await prisma.location.deleteMany({ where: { warehouseId } });
    await prisma.warehouse.delete({ where: { id: warehouseId } });
    await prisma.$disconnect();
  });

  describe(`${RACERS} concurrent validations: exactly one posts`, () => {
    it('receipt (two lines → two moves, once)', async () => {
      const r = await receipts.create({
        lines: [
          { productId: steel, qty: 4 },
          { productId: bolts, qty: 6 },
        ],
      });
      expectOneWinner(await race(() => receipts.validate(r.id, { locationId: shelf })));
      expect(await movesFor(r.id)).toBe(2);
      expect(await stock.stockOnHand(steel, shelf)).toBe(4);
    });

    it('delivery', async () => {
      const d = await deliveries.create({ lines: [{ productId: steel, qty: 5 }] });
      const before = await stock.stockOnHand(steel, store);
      expectOneWinner(await race(() => deliveries.validate(d.id, { locationId: store })));
      expect(await movesFor(d.id)).toBe(1);
      expect(await stock.stockOnHand(steel, store)).toBe(before - 5);
    });

    it('transfer', async () => {
      const t = await transfers.create({
        lines: [{ productId: bolts, qty: 7, fromLocationId: store, toLocationId: shelf }],
      });
      expectOneWinner(await race(() => transfers.validate(t.id)));
      expect(await movesFor(t.id)).toBe(1);
    });

    it('adjustment', async () => {
      const onHand = await stock.stockOnHand(bolts, store);
      const a = await adjustments.create({
        locationId: store,
        lines: [{ productId: bolts, countedQty: onHand + 3 }],
      });
      expectOneWinner(await race(() => adjustments.validate(a.id)));
      expect(await movesFor(a.id)).toBe(1);
      expect(await stock.stockOnHand(bolts, store)).toBe(onHand + 3);
    });
  });

  describe('PATCH cannot mark a document DONE (that would skip the ledger)', () => {
    const rejectsDone = async (
      update: () => Promise<unknown>,
      status: () => Promise<DocStatus | undefined>,
      docId: string,
    ) => {
      await expect(update()).rejects.toBeInstanceOf(BadRequestException);
      expect(await status()).toBe(DocStatus.DRAFT);
      expect(await movesFor(docId)).toBe(0);
    };

    it('receipt', async () => {
      const r = await receipts.create({ lines: [{ productId: steel, qty: 1 }] });
      await rejectsDone(
        () => receipts.update(r.id, { status: DocStatus.DONE } as never),
        async () => (await prisma.receipt.findUnique({ where: { id: r.id } }))?.status,
        r.id,
      );
    });

    it('delivery', async () => {
      const d = await deliveries.create({ lines: [{ productId: steel, qty: 1 }] });
      await rejectsDone(
        () => deliveries.update(d.id, { status: DocStatus.DONE } as never),
        async () => (await prisma.delivery.findUnique({ where: { id: d.id } }))?.status,
        d.id,
      );
    });

    it('transfer', async () => {
      const t = await transfers.create({
        lines: [{ productId: steel, qty: 1, fromLocationId: store, toLocationId: shelf }],
      });
      await rejectsDone(
        () => transfers.update(t.id, { status: DocStatus.DONE } as never),
        async () => (await prisma.transfer.findUnique({ where: { id: t.id } }))?.status,
        t.id,
      );
    });

    it('adjustment', async () => {
      const a = await adjustments.create({ locationId: store, lines: [{ productId: steel, countedQty: 1 }] });
      await rejectsDone(
        () => adjustments.update(a.id, { status: DocStatus.DONE } as never),
        async () => (await prisma.adjustment.findUnique({ where: { id: a.id } }))?.status,
        a.id,
      );
    });
  });
});
