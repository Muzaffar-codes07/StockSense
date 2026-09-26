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
  createdById?: string | null; // who posted the move (audit trail)
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
    const write = (db: Prisma.TransactionClient) =>
      db.stockMove.create({
        data: {
          productId: input.productId,
          qty: new Prisma.Decimal(input.qty),
          moveType: input.moveType,
          fromLocationId: input.fromLocationId ?? null,
          toLocationId: input.toLocationId ?? null,
          docType: input.docType,
          docId: input.docId,
          createdById: input.createdById ?? null,
        },
      });

    const fromLocationId = input.fromLocationId;
    if (!fromLocationId) return write(tx ?? this.prisma);

    // Outgoing move: the check and the write must be atomic, so they always run
    // in a transaction (the caller's, or a new one).
    const guarded = async (db: Prisma.TransactionClient) => {
      await this.assertAvailable(db, input.productId, fromLocationId, input.qty);
      return write(db);
    };
    return tx ? guarded(tx) : this.prisma.$transaction(guarded);
  }

  /**
   * Stock can never go negative. Serialises writers per (product, location) with
   * a transaction-scoped advisory lock, then reads on-hand through the same
   * transaction so earlier lines of the same document are counted.
   */
  /**
   * Serialise every writer of one (product, location) for the rest of the
   * transaction. Reentrant, so a caller holding it can still postMove().
   */
  async lockStock(productId: string, locationId: string, db: Prisma.TransactionClient) {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${productId} || ':' || ${locationId}))`;
  }

  private async assertAvailable(
    db: Prisma.TransactionClient,
    productId: string,
    locationId: string,
    qty: number,
  ) {
    await this.lockStock(productId, locationId, db);
    // Full-Decimal comparison — no JS-float round-trip in the availability guard.
    const available = await this.onHandDecimal(productId, locationId, db);
    if (available.lessThan(new Prisma.Decimal(qty))) {
      const product = await db.product.findUnique({
        where: { id: productId },
        select: { name: true, sku: true },
      });
      const label = product ? `${product.name} (${product.sku})` : productId;
      throw new BadRequestException(
        `Not enough stock for ${label}: ${available.toString()} available, ${qty} requested`,
      );
    }
  }

  /**
   * Exact on-hand as a Decimal (in − out) at a location. Used by the guard so
   * the availability check keeps full precision. `stockOnHand` is the
   * number-returning public wrapper. Pass `db` to read inside a transaction.
   */
  private async onHandDecimal(
    productId: string,
    locationId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Prisma.Decimal> {
    const [inAgg, outAgg] = await Promise.all([
      db.stockMove.aggregate({
        _sum: { qty: true },
        where: { productId, toLocationId: locationId },
      }),
      db.stockMove.aggregate({
        _sum: { qty: true },
        where: { productId, fromLocationId: locationId },
      }),
    ]);
    return this.net(inAgg._sum.qty, outAgg._sum.qty);
  }

  /**
   * Current on-hand quantity of a product at a single location. Pass `db` to
   * read inside a transaction.
   */
  async stockOnHand(
    productId: string,
    locationId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return (await this.onHandDecimal(productId, locationId, db)).toNumber();
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
    return this.net(inAgg._sum.qty, outAgg._sum.qty).toNumber();
  }

  /** Exact Decimal subtraction of summed inputs/outputs. */
  private net(
    inSum: Prisma.Decimal | null,
    outSum: Prisma.Decimal | null,
  ): Prisma.Decimal {
    const zero = new Prisma.Decimal(0);
    return (inSum ?? zero).minus(outSum ?? zero);
  }
}
