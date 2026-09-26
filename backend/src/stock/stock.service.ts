import { BadRequestException, Injectable } from '@nestjs/common';
import { MoveType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PostMoveInput {
  productId: string;
  qty: number; // always positive; direction is set by from/to locations
  moveType: MoveType;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  docType?: string;
  docId?: string;
}

/**
 * StockService — the heart of StockSense.
 *
 * Every stock change goes through `postMove`. Nothing else writes stock.
 * Current stock is DERIVED by summing moves, never stored as a mutable number:
 *
 *   qty(product, location) = Σ(moves INTO location) − Σ(moves OUT OF location)
 *
 * Role 4 calls `postMove` from receipt/delivery/transfer/adjustment "validate".
 * Role 3 reads `stockOnHand` / `totalStock` for stock views, alerts and KPIs.
 *
 * Pass a Prisma transaction client (`tx`) when posting several moves atomically
 * (e.g. validating a multi-line document) so all lines commit or none do.
 */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async postMove(input: PostMoveInput, tx?: Prisma.TransactionClient) {
    if (input.qty <= 0) {
      throw new BadRequestException('qty must be greater than 0');
    }
    if (!input.fromLocationId && !input.toLocationId) {
      throw new BadRequestException(
        'a move needs a fromLocation, a toLocation, or both',
      );
    }
    const db = tx ?? this.prisma;
    return db.stockMove.create({
      data: {
        productId: input.productId,
        qty: input.qty,
        moveType: input.moveType,
        fromLocationId: input.fromLocationId ?? null,
        toLocationId: input.toLocationId ?? null,
        docType: input.docType,
        docId: input.docId,
      },
    });
  }

  /** Current on-hand quantity of a product at a single location. */
  async stockOnHand(productId: string, locationId: string): Promise<number> {
    const [inAgg, outAgg] = await Promise.all([
      this.prisma.stockMove.aggregate({
        _sum: { qty: true },
        where: { productId, toLocationId: locationId },
      }),
      this.prisma.stockMove.aggregate({
        _sum: { qty: true },
        where: { productId, fromLocationId: locationId },
      }),
    ]);
    return (inAgg._sum.qty ?? 0) - (outAgg._sum.qty ?? 0);
  }

  /** Total on-hand of a product across all locations. */
  async totalStock(productId: string): Promise<number> {
    const [inAgg, outAgg] = await Promise.all([
      this.prisma.stockMove.aggregate({
        _sum: { qty: true },
        where: { productId, toLocationId: { not: null } },
      }),
      this.prisma.stockMove.aggregate({
        _sum: { qty: true },
        where: { productId, fromLocationId: { not: null } },
      }),
    ]);
    return (inAgg._sum.qty ?? 0) - (outAgg._sum.qty ?? 0);
  }
}
