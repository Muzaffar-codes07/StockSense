import { BadRequestException } from '@nestjs/common';
import { MoveType, Prisma } from '@prisma/client';
import { StockService } from './stock.service';

// Mock only the PrismaClient surface StockService touches — no DB required.
function makePrismaMock() {
  return {
    stockMove: {
      create: jest.fn().mockResolvedValue({ id: 'move-1' }),
      aggregate: jest.fn(),
    },
  };
}

describe('StockService (ledger core)', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: StockService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new StockService(prisma as never);
  });

  describe('postMove validation', () => {
    it('rejects non-positive quantities', async () => {
      await expect(
        service.postMove({
          productId: 'p1',
          qty: 0,
          moveType: MoveType.RECEIPT,
          toLocationId: 'loc1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.stockMove.create).not.toHaveBeenCalled();
    });

    it('rejects a move with neither a from nor a to location', async () => {
      await expect(
        service.postMove({ productId: 'p1', qty: 5, moveType: MoveType.RECEIPT }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('postMove persistence', () => {
    it('writes a Decimal quantity and the right direction for a receipt', async () => {
      await service.postMove({
        productId: 'p1',
        qty: 50,
        moveType: MoveType.RECEIPT,
        toLocationId: 'loc1',
        createdById: 'user1',
      });
      const arg = prisma.stockMove.create.mock.calls[0][0];
      expect(arg.data.qty).toBeInstanceOf(Prisma.Decimal);
      expect(arg.data.qty.toNumber()).toBe(50);
      expect(arg.data.toLocationId).toBe('loc1');
      expect(arg.data.fromLocationId).toBeNull();
      expect(arg.data.createdById).toBe('user1');
    });

    it('uses the transaction client when one is provided', async () => {
      const tx = { stockMove: { create: jest.fn().mockResolvedValue({}) } };
      await service.postMove(
        { productId: 'p1', qty: 10, moveType: MoveType.DELIVERY, fromLocationId: 'loc1' },
        tx as never,
      );
      expect(tx.stockMove.create).toHaveBeenCalledTimes(1);
      expect(prisma.stockMove.create).not.toHaveBeenCalled();
    });
  });

  describe('derived stock', () => {
    it('stockOnHand = sum(in) - sum(out) at a location', async () => {
      prisma.stockMove.aggregate
        .mockResolvedValueOnce({ _sum: { qty: new Prisma.Decimal(100) } }) // in
        .mockResolvedValueOnce({ _sum: { qty: new Prisma.Decimal(30) } }); // out
      expect(await service.stockOnHand('p1', 'loc1')).toBe(70);
    });

    it('treats null sums as zero', async () => {
      prisma.stockMove.aggregate
        .mockResolvedValueOnce({ _sum: { qty: null } })
        .mockResolvedValueOnce({ _sum: { qty: null } });
      expect(await service.totalStock('p1')).toBe(0);
    });

    it('matches the spec demo flow: receive 100, deliver 20, adjust -3 => 77', async () => {
      prisma.stockMove.aggregate
        .mockResolvedValueOnce({ _sum: { qty: new Prisma.Decimal(100) } }) // in: receipt
        .mockResolvedValueOnce({ _sum: { qty: new Prisma.Decimal(23) } }); // out: 20 delivery + 3 damaged
      expect(await service.totalStock('steel')).toBe(77);
    });
  });
});
