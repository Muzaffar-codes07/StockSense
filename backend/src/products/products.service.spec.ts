import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LocationType, MoveType, Prisma } from '@prisma/client';
import { ProductsService } from './products.service';

function makeDeps() {
  const tx = {
    product: { create: jest.fn().mockResolvedValue({ id: 'p1' }) },
    location: { findFirst: jest.fn().mockResolvedValue({ id: 'loc-main' }) },
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    product: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'p1', name: 'Steel', sku: 'STEEL-1', uom: 'kg',
        unitCost: new Prisma.Decimal('12.50'), isActive: true, category: null,
        reorderRules: [], createdAt: new Date(), updatedAt: new Date(),
      }),
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue({}),
    },
    reorderRule: { upsert: jest.fn(), deleteMany: jest.fn() },
  };
  const stock = { postMove: jest.fn().mockResolvedValue({}) };
  const inventory = { list: jest.fn(), locations: jest.fn().mockResolvedValue([]) };
  const service = new ProductsService(prisma as never, stock as never, inventory as never);
  return { tx, prisma, stock, service };
}

const dupSku = () =>
  new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });

describe('ProductsService', () => {
  it('posts initial stock as an ADJUSTMENT into the first stock location, in the same transaction', async () => {
    const { tx, stock, service } = makeDeps();
    await service.create({ name: 'Steel', sku: 'STEEL-1', initialStock: { qty: 100 } }, 'user-1');
    expect(tx.location.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: LocationType.STOCK } }),
    );
    expect(stock.postMove).toHaveBeenCalledWith(
      {
        productId: 'p1', qty: 100, moveType: MoveType.ADJUSTMENT,
        toLocationId: 'loc-main', docType: 'initial', docId: 'p1', createdById: 'user-1',
      },
      tx,
    );
  });

  it('uses the chosen location for initial stock', async () => {
    const { tx, stock, service } = makeDeps();
    await service.create(
      { name: 'Steel', sku: 'STEEL-1', initialStock: { qty: 5, locationId: 'loc-rack' } },
      'user-1',
    );
    expect(tx.location.findFirst).not.toHaveBeenCalled();
    expect(stock.postMove.mock.calls[0][0].toLocationId).toBe('loc-rack');
  });

  it('refuses initial stock when no stock location exists', async () => {
    const { tx, stock, service } = makeDeps();
    tx.location.findFirst.mockResolvedValue(null);
    await expect(
      service.create({ name: 'S', sku: 'S1', initialStock: { qty: 5 } }, 'u'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(stock.postMove).not.toHaveBeenCalled();
  });

  it('posts no move when there is no initial stock', async () => {
    const { stock, service } = makeDeps();
    await service.create({ name: 'S', sku: 'S1' }, 'u');
    expect(stock.postMove).not.toHaveBeenCalled();
  });

  it('turns a duplicate SKU into a 409 with a readable message', async () => {
    const { tx, service } = makeDeps();
    tx.product.create.mockRejectedValue(dupSku());
    await expect(service.create({ name: 'S', sku: 'S1' }, 'u')).rejects.toThrow(
      new ConflictException('SKU already exists'),
    );
  });

  it('returns numbers, not Decimal strings, in the detail view', async () => {
    const { service } = makeDeps();
    const detail = await service.findOne('p1');
    expect(detail.unitCost).toBe(12.5);
    expect(detail.reorderRule).toBeNull();
  });

  it('rejects a reorder rule whose max is below its min without touching the DB', async () => {
    const { prisma, service } = makeDeps();
    await expect(service.setReorderRule('p1', { minQty: 10, maxQty: 5 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.reorderRule.upsert).not.toHaveBeenCalled();
  });

  it('404s when updating a product that does not exist', async () => {
    const { prisma, service } = makeDeps();
    prisma.product.count.mockResolvedValue(0);
    await expect(service.update('nope', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('archives instead of deleting', async () => {
    const { prisma, service } = makeDeps();
    await service.archive('p1');
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { isActive: false },
    });
  });
});
