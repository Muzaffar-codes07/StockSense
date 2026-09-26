import { MoveType, PrismaClient } from '@prisma/client';
import { StockService } from '../stock/stock.service';
import { AdjustmentsService } from './adjustments.service';

// Issue #13 (audit §8.8): an adjustment records what was physically counted.
// Validating it must set stock to that count, measured against on-hand at
// validate time — not against a difference frozen when the draft was created.
describe('adjustment validate uses current on-hand (live DB)', () => {
  const prisma = new PrismaClient();
  const stock = new StockService(prisma as never);
  const adjustments = new AdjustmentsService(prisma as never, stock);
  const tag = `A${Date.now()}`;
  let warehouseId: string;
  let store: string;
  let productId: string;

  const receive = (qty: number) =>
    stock.postMove({ productId, qty, moveType: MoveType.RECEIPT, toLocationId: store });
  const onHand = () => stock.stockOnHand(productId, store);

  beforeAll(async () => {
    warehouseId = (await prisma.warehouse.create({ data: { name: `${tag} WH` } })).id;
    store = (await prisma.location.create({ data: { warehouseId, name: `${tag} Store` } })).id;
    productId = (await prisma.product.create({ data: { name: `${tag} Paint`, sku: `${tag}-PNT` } })).id;
  });

  afterAll(async () => {
    await prisma.stockMove.deleteMany({ where: { productId } });
    await prisma.adjustmentLine.deleteMany({ where: { productId } });
    await prisma.adjustment.deleteMany({ where: { locationId: store } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.location.deleteMany({ where: { warehouseId } });
    await prisma.warehouse.delete({ where: { id: warehouseId } });
    await prisma.$disconnect();
  });

  it('lands on the counted quantity even if stock moved after the draft was created', async () => {
    await receive(10);
    const draft = await adjustments.create({ locationId: store, lines: [{ productId, countedQty: 0 }] });
    expect(draft.lines[0].diff.toNumber()).toBe(-10); // preview at create time

    await receive(20); // on hand is now 30 before anyone validates

    const done = await adjustments.validate(draft.id);
    expect(await onHand()).toBe(0); // what was counted
    // The stored line reflects what was actually posted.
    expect([done.lines[0].recordedQty.toNumber(), done.lines[0].diff.toNumber()]).toEqual([30, -30]);
  });

  it('posts nothing when the count already matches on-hand at validate time', async () => {
    await receive(5); // on hand 5
    const draft = await adjustments.create({ locationId: store, lines: [{ productId, countedQty: 9 }] });
    await receive(4); // now 9, exactly the count
    const before = await prisma.stockMove.count({ where: { productId } });
    await adjustments.validate(draft.id);
    expect(await onHand()).toBe(9);
    expect(await prisma.stockMove.count({ where: { productId } })).toBe(before);
  });
});
