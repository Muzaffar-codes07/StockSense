import { NotFoundException } from '@nestjs/common';
import { MoveType, PrismaClient } from '@prisma/client';
import { StockService } from '../stock/stock.service';
import { InventoryService } from './inventory.service';
import { StockQuantRepository } from './stock-quant.repository';

// Runs the brief's demo flow against the real database and checks every
// derived figure. Creates its own uniquely-tagged rows and removes them after.
describe('stock_quant + StockQuantRepository (live DB)', () => {
  const prisma = new PrismaClient();
  const stock = new StockService(prisma as never);
  const repo = new StockQuantRepository(prisma as never);
  const inventory = new InventoryService(repo, prisma as never);
  const tag = `T${Date.now()}`;
  let warehouseId: string;
  let mainStore: string;
  let rack: string;
  let steel: string;
  let idle: string;
  let archived: string;

  beforeAll(async () => {
    warehouseId = (await prisma.warehouse.create({ data: { name: `${tag} WH` } })).id;
    mainStore = (await prisma.location.create({ data: { warehouseId, name: 'Main Store' } })).id;
    rack = (
      await prisma.location.create({
        data: { warehouseId, name: 'Production Rack', type: 'PRODUCTION' },
      })
    ).id;
    steel = (
      await prisma.product.create({
        data: { name: `${tag} Steel`, sku: `${tag}-STEEL`, uom: 'kg', unitCost: 10 },
      })
    ).id;
    idle = (await prisma.product.create({ data: { name: `${tag} Idle`, sku: `${tag}-IDLE` } })).id;
    archived = (
      await prisma.product.create({
        data: { name: `${tag} Old`, sku: `${tag}-OLD`, isActive: false },
      })
    ).id;
    await prisma.reorderRule.create({ data: { productId: steel, minQty: 80 } });

    // Receive 100 -> move 30 to the rack -> deliver 20 from the rack -> 3 damaged
    await stock.postMove({ productId: steel, qty: 100, moveType: MoveType.RECEIPT, toLocationId: mainStore });
    await stock.postMove({ productId: steel, qty: 30, moveType: MoveType.INTERNAL, fromLocationId: mainStore, toLocationId: rack });
    await stock.postMove({ productId: steel, qty: 20, moveType: MoveType.DELIVERY, fromLocationId: rack });
    await stock.postMove({ productId: steel, qty: 3, moveType: MoveType.ADJUSTMENT, fromLocationId: mainStore });
    await stock.postMove({ productId: archived, qty: 5, moveType: MoveType.RECEIPT, toLocationId: mainStore });
  });

  afterAll(async () => {
    const ids = [steel, idle, archived];
    await prisma.stockMove.deleteMany({ where: { productId: { in: ids } } });
    await prisma.reorderRule.deleteMany({ where: { productId: { in: ids } } });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
    await prisma.location.deleteMany({ where: { warehouseId } });
    await prisma.warehouse.delete({ where: { id: warehouseId } });
    await prisma.$disconnect();
  });

  it('totals the demo flow to exactly 77', async () => {
    const { rows } = await repo.findRows({ search: `${tag} Steel` });
    expect(rows).toHaveLength(1);
    expect(rows[0].onHand).toBe(77);
  });

  it('splits stock per location: 67 in Main Store, 10 on the rack', async () => {
    const locations = await repo.byLocation(steel);
    expect(locations.map((l) => [l.locationName, l.qty])).toEqual([
      ['Main Store', 67],
      ['Production Rack', 10],
    ]);
  });

  it('lists products with no moves as OUT, flags LOW at/under the minimum, hides archived', async () => {
    const { rows, total } = await repo.findRows({ search: tag });
    expect(total).toBe(2);
    expect(Object.fromEntries(rows.map((r) => [r.name, r.status]))).toEqual({
      [`${tag} Idle`]: 'OUT',
      [`${tag} Steel`]: 'LOW',
    });
  });

  it('filters by status', async () => {
    const { rows, total } = await repo.findRows({ search: tag, statuses: ['OUT'] });
    expect(total).toBe(1);
    expect(rows[0].name).toBe(`${tag} Idle`);
  });

  it('counts KPIs including this data', async () => {
    const k = await repo.kpis();
    expect(k.lowStock).toBeGreaterThanOrEqual(1);
    expect(k.outOfStock).toBeGreaterThanOrEqual(1);
    expect(k.totalProductsInStock).toBeGreaterThanOrEqual(1);
    expect(k.stockValue).toBeGreaterThanOrEqual(770); // 77 kg x 10
  });

  it('subtracts only WAITING/READY deliveries from free-to-use', async () => {
    const ready = await prisma.delivery.create({
      data: { status: 'READY', lines: { create: { productId: steel, qty: 7 } } },
    });
    const draft = await prisma.delivery.create({
      data: { status: 'DRAFT', lines: { create: { productId: steel, qty: 100 } } },
    });
    try {
      const { rows } = await repo.findRows({ search: `${tag} Steel` });
      expect(rows[0].reserved).toBe(7);
      expect(rows[0].freeToUse).toBe(70);
    } finally {
      await prisma.delivery.deleteMany({ where: { id: { in: [ready.id, draft.id] } } });
    }
  });

  it('forecasts on hand + open receipts − open deliveries (drafts and done ignored)', async () => {
    const docs = await Promise.all([
      prisma.receipt.create({ data: { status: 'READY', lines: { create: { productId: steel, qty: 40 } } } }),
      prisma.receipt.create({ data: { status: 'DRAFT', lines: { create: { productId: steel, qty: 500 } } } }),
      prisma.receipt.create({ data: { status: 'DONE', lines: { create: { productId: steel, qty: 900 } } } }),
    ]);
    const delivery = await prisma.delivery.create({
      data: { status: 'WAITING', lines: { create: { productId: steel, qty: 7 } } },
    });
    try {
      const { rows } = await repo.findRows({ search: `${tag} Steel` });
      expect(rows[0]).toMatchObject({ onHand: 77, incoming: 40, reserved: 7, forecast: 110 });
      const { rows: idleRows } = await repo.findRows({ search: `${tag} Idle` });
      expect(idleRows[0]).toMatchObject({ incoming: 0, forecast: 0 });
    } finally {
      await prisma.receipt.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
      await prisma.delivery.delete({ where: { id: delivery.id } });
    }
  });

  it('breaks free-to-use and forecast down into locations and open documents', async () => {
    const partner = await prisma.partner.create({ data: { name: `${tag} Beta`, type: 'CUSTOMER' } });
    const delivery = await prisma.delivery.create({
      data: { status: 'WAITING', partnerId: partner.id, lines: { create: [{ productId: steel, qty: 4 }, { productId: steel, qty: 3 }] } },
    });
    const receipt = await prisma.receipt.create({
      data: { status: 'READY', lines: { create: { productId: steel, qty: 40 } } },
    });
    const draft = await prisma.delivery.create({
      data: { status: 'DRAFT', lines: { create: { productId: steel, qty: 100 } } },
    });
    try {
      const b = await inventory.breakdown(steel);
      expect(b).toMatchObject({ name: `${tag} Steel`, uom: 'kg', onHand: 77, reserved: 7, freeToUse: 70, incoming: 40, forecast: 110 });
      expect(b.locations.map((l) => [l.locationName, l.qty])).toEqual([['Main Store', 67], ['Production Rack', 10]]);
      // One entry per document, lines of the same document summed; drafts left out.
      expect(b.reservedBy).toEqual([
        expect.objectContaining({
          docId: delivery.id,
          reference: `DEL-${delivery.id.slice(0, 8).toUpperCase()}`,
          partnerName: `${tag} Beta`,
          status: 'WAITING',
          qty: 7,
        }),
      ]);
      expect(b.incomingFrom).toEqual([
        expect.objectContaining({ reference: `REC-${receipt.id.slice(0, 8).toUpperCase()}`, partnerName: null, qty: 40 }),
      ]);
      // The explanation adds up to exactly what the Stock list shows.
      const { rows } = await repo.findRows({ search: `${tag} Steel` });
      expect([rows[0].freeToUse, rows[0].forecast]).toEqual([b.freeToUse, b.forecast]);
    } finally {
      await prisma.delivery.deleteMany({ where: { id: { in: [delivery.id, draft.id] } } });
      await prisma.receipt.delete({ where: { id: receipt.id } });
      await prisma.partner.delete({ where: { id: partner.id } });
    }
  });

  it('breakdown of an unknown product is 404', async () => {
    await expect(inventory.breakdown('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('treats % in search text literally', async () => {
    const { rows } = await repo.findRows({ search: '%' });
    expect(rows).toHaveLength(0);
  });

  it('is OK once on-hand is above the minimum', async () => {
    await prisma.reorderRule.update({ where: { productId: steel }, data: { minQty: 50 } });
    const { rows } = await repo.findRows({ search: `${tag} Steel` });
    expect(rows[0].status).toBe('OK');
  });
});
