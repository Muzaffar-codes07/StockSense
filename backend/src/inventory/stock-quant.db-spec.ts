import { MoveType, PrismaClient } from '@prisma/client';
import { StockService } from '../stock/stock.service';
import { StockQuantRepository } from './stock-quant.repository';

// Runs the brief's demo flow against the real database and checks every
// derived figure. Creates its own uniquely-tagged rows and removes them after.
describe('stock_quant + StockQuantRepository (live DB)', () => {
  const prisma = new PrismaClient();
  const stock = new StockService(prisma as never);
  const repo = new StockQuantRepository(prisma as never);
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
