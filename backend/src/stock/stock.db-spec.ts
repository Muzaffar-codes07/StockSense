import { BadRequestException } from '@nestjs/common';
import { MoveType, PrismaClient } from '@prisma/client';
import { StockService } from './stock.service';

// The ledger must never let a location's stock go negative (issue #11), even
// across the lines of one document or two documents validated at once.
describe('StockService.postMove stock guard (live DB)', () => {
  const prisma = new PrismaClient();
  const stock = new StockService(prisma as never);
  const tag = `T${Date.now()}`;
  let warehouseId: string;
  let store: string;
  let productId: string;

  const onHand = () => stock.stockOnHand(productId, store);
  const out = (qty: number) => ({
    productId,
    qty,
    moveType: MoveType.DELIVERY,
    fromLocationId: store,
  });

  beforeAll(async () => {
    warehouseId = (await prisma.warehouse.create({ data: { name: `${tag} WH` } })).id;
    store = (await prisma.location.create({ data: { warehouseId, name: `${tag} Store` } })).id;
    productId = (
      await prisma.product.create({ data: { name: `${tag} Steel`, sku: `${tag}-STEEL` } })
    ).id;
    await stock.postMove({ productId, qty: 10, moveType: MoveType.RECEIPT, toLocationId: store });
  });

  afterAll(async () => {
    await prisma.stockMove.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.location.deleteMany({ where: { warehouseId } });
    await prisma.warehouse.delete({ where: { id: warehouseId } });
    await prisma.$disconnect();
  });

  it('rejects an outgoing move larger than on-hand and posts nothing', async () => {
    await expect(stock.postMove(out(25))).rejects.toThrow(
      new BadRequestException(`Not enough stock for ${tag} Steel (${tag}-STEEL): 10 available, 25 requested`),
    );
    expect(await onHand()).toBe(10);
  });

  it('counts earlier lines of the same document (reads through the transaction)', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await stock.postMove(out(6), tx);
        await stock.postMove(out(6), tx); // only 4 left inside this transaction
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await onHand()).toBe(10); // whole document rolled back
  });

  it('lets exactly one of two concurrent deliveries take the last stock', async () => {
    const results = await Promise.allSettled([
      prisma.$transaction((tx) => stock.postMove(out(6), tx)),
      prisma.$transaction((tx) => stock.postMove(out(6), tx)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await onHand()).toBe(4);
  });

  it('still allows taking exactly what is on hand', async () => {
    await stock.postMove(out(4));
    expect(await onHand()).toBe(0);
  });
});
