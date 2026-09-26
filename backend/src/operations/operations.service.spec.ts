/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';
import { DocStatus, MoveType, Prisma } from '@prisma/client';
import { AdjustmentsService } from './adjustments.service';
import { DeliveriesService } from './deliveries.service';
import { ReceiptsService } from './receipts.service';
import { TransfersService } from './transfers.service';

describe('Operations Services', () => {
  describe('ReceiptsService', () => {
    let prisma: any;
    let stock: any;
    let service: ReceiptsService;

    beforeEach(() => {
      const tx = {
        receipt: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn().mockResolvedValue({ id: 'r1', status: DocStatus.DONE }) },
        receiptLine: { deleteMany: jest.fn(), createMany: jest.fn() },
      };
      prisma = {
        $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
        receipt: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        location: {
          findUnique: jest.fn(),
        },
      };
      stock = {
        postMove: jest.fn().mockResolvedValue({ id: 'move-1' }),
      };
      service = new ReceiptsService(prisma, stock);
    });

    it('creates a receipt with lines in DRAFT status', async () => {
      prisma.receipt.create.mockResolvedValue({ id: 'r1', status: DocStatus.DRAFT });
      const result = await service.create({
        partnerId: 'partner-1',
        lines: [{ productId: 'p1', qty: 50 }],
      });
      expect(prisma.receipt.create).toHaveBeenCalled();
      expect(result.status).toBe(DocStatus.DRAFT);
    });

    it('rejects creating a receipt with no lines', async () => {
      await expect(
        service.create({ lines: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('validates a receipt and posts RECEIPT moves into the destination location', async () => {
      prisma.receipt.findUnique.mockResolvedValue({
        id: 'r1',
        status: DocStatus.READY,
        lines: [{ productId: 'p1', qty: new Prisma.Decimal(100) }],
      });
      prisma.location.findUnique.mockResolvedValue({ id: 'loc-store' });

      await service.validate('r1', { locationId: 'loc-store' }, 'user-1');

      expect(stock.postMove).toHaveBeenCalledWith(
        {
          productId: 'p1',
          qty: 100,
          moveType: MoveType.RECEIPT,
          toLocationId: 'loc-store',
          docType: 'receipt',
          docId: 'r1',
          createdById: 'user-1',
        },
        expect.anything(),
      );
    });

    it('rejects validating an already DONE receipt', async () => {
      prisma.receipt.findUnique.mockResolvedValue({
        id: 'r1',
        status: DocStatus.DONE,
        lines: [{ productId: 'p1', qty: new Prisma.Decimal(100) }],
      });
      await expect(
        service.validate('r1', { locationId: 'loc-store' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('DeliveriesService', () => {
    let prisma: any;
    let stock: any;
    let service: DeliveriesService;

    beforeEach(() => {
      const tx = {
        delivery: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn().mockResolvedValue({ id: 'd1', status: DocStatus.DONE }) },
        deliveryLine: { deleteMany: jest.fn(), createMany: jest.fn() },
      };
      prisma = {
        $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
        delivery: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        location: {
          findUnique: jest.fn(),
        },
      };
      stock = {
        postMove: jest.fn().mockResolvedValue({ id: 'move-1' }),
      };
      service = new DeliveriesService(prisma, stock);
    });

    it('validates a delivery and posts DELIVERY moves out of the source location', async () => {
      prisma.delivery.findUnique.mockResolvedValue({
        id: 'd1',
        status: DocStatus.READY,
        lines: [{ productId: 'p1', qty: new Prisma.Decimal(20) }],
      });
      prisma.location.findUnique.mockResolvedValue({ id: 'loc-rack' });

      await service.validate('d1', { locationId: 'loc-rack' }, 'user-1');

      expect(stock.postMove).toHaveBeenCalledWith(
        {
          productId: 'p1',
          qty: 20,
          moveType: MoveType.DELIVERY,
          fromLocationId: 'loc-rack',
          docType: 'delivery',
          docId: 'd1',
          createdById: 'user-1',
        },
        expect.anything(),
      );
    });
  });

  describe('TransfersService', () => {
    let prisma: any;
    let stock: any;
    let service: TransfersService;

    beforeEach(() => {
      const tx = {
        transfer: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn().mockResolvedValue({ id: 't1', status: DocStatus.DONE }) },
        transferLine: { deleteMany: jest.fn(), createMany: jest.fn() },
      };
      prisma = {
        $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
        transfer: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
      };
      stock = {
        postMove: jest.fn().mockResolvedValue({ id: 'move-1' }),
      };
      service = new TransfersService(prisma, stock);
    });

    it('rejects transfer where from and to locations are identical', async () => {
      await expect(
        service.create({
          lines: [
            {
              productId: 'p1',
              qty: 10,
              fromLocationId: 'loc-a',
              toLocationId: 'loc-a',
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('validates a transfer and posts INTERNAL moves from loc-a to loc-b', async () => {
      prisma.transfer.findUnique.mockResolvedValue({
        id: 't1',
        status: DocStatus.READY,
        lines: [
          {
            productId: 'p1',
            qty: new Prisma.Decimal(40),
            fromLocationId: 'loc-store',
            toLocationId: 'loc-rack',
          },
        ],
      });

      await service.validate('t1', 'user-1');

      expect(stock.postMove).toHaveBeenCalledWith(
        {
          productId: 'p1',
          qty: 40,
          moveType: MoveType.INTERNAL,
          fromLocationId: 'loc-store',
          toLocationId: 'loc-rack',
          docType: 'transfer',
          docId: 't1',
          createdById: 'user-1',
        },
        expect.anything(),
      );
    });
  });

  describe('AdjustmentsService', () => {
    let prisma: any;
    let stock: any;
    let service: AdjustmentsService;

    beforeEach(() => {
      const tx = {
        adjustment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn().mockResolvedValue({ id: 'adj-1', status: DocStatus.DONE }) },
      };
      prisma = {
        $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
        adjustment: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        location: {
          findUnique: jest.fn(),
        },
      };
      stock = {
        stockOnHand: jest.fn().mockResolvedValue(20),
        postMove: jest.fn().mockResolvedValue({ id: 'move-1' }),
      };
      service = new AdjustmentsService(prisma, stock);
    });

    it('computes diff = counted - recorded on create', async () => {
      prisma.location.findUnique.mockResolvedValue({ id: 'loc-rack' });
      prisma.adjustment.create.mockImplementation((args: any) => args.data);

      await service.create({
        locationId: 'loc-rack',
        lines: [{ productId: 'p1', countedQty: 17 }], // 17 counted, 20 recorded -> diff -3
      });

      expect(prisma.adjustment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lines: {
              create: [
                expect.objectContaining({
                  productId: 'p1',
                  countedQty: new Prisma.Decimal(17),
                  recordedQty: new Prisma.Decimal(20),
                  diff: new Prisma.Decimal(-3),
                }),
              ],
            },
          }),
        }),
      );
    });

    it('validates adjustment with negative diff by posting move OUT of location', async () => {
      prisma.adjustment.findUnique.mockResolvedValue({
        id: 'adj-1',
        locationId: 'loc-rack',
        status: DocStatus.DRAFT,
        lines: [
          {
            productId: 'p1',
            diff: new Prisma.Decimal(-3),
          },
        ],
      });

      await service.validate('adj-1', 'user-1');

      expect(stock.postMove).toHaveBeenCalledWith(
        {
          productId: 'p1',
          qty: 3,
          moveType: MoveType.ADJUSTMENT,
          fromLocationId: 'loc-rack',
          docType: 'adjustment',
          docId: 'adj-1',
          createdById: 'user-1',
        },
        expect.anything(),
      );
    });

    it('validates adjustment with positive diff by posting move INTO location', async () => {
      prisma.adjustment.findUnique.mockResolvedValue({
        id: 'adj-1',
        locationId: 'loc-rack',
        status: DocStatus.DRAFT,
        lines: [
          {
            productId: 'p1',
            diff: new Prisma.Decimal(5),
          },
        ],
      });

      await service.validate('adj-1', 'user-1');

      expect(stock.postMove).toHaveBeenCalledWith(
        {
          productId: 'p1',
          qty: 5,
          moveType: MoveType.ADJUSTMENT,
          toLocationId: 'loc-rack',
          docType: 'adjustment',
          docId: 'adj-1',
          createdById: 'user-1',
        },
        expect.anything(),
      );
    });
  });
});
