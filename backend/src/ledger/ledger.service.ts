import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AsOfQueryDto } from './dto/as-of-query.dto';
import { integrityQueries } from './ledger.queries';

type RawViolation = Record<
  string,
  string | number | bigint | Prisma.Decimal | null
>;

interface HistoricalRow {
  productId: string;
  name: string;
  sku: string;
  uom: string;
  locationId: string;
  locationName: string;
  warehouseName: string;
  qty: Prisma.Decimal;
}

export interface HistoricalProduct {
  productId: string;
  name: string;
  sku: string;
  uom: string;
  locations: {
    locationId: string;
    locationName: string;
    warehouseName: string;
    qty: number;
  }[];
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async integrity() {
    const checkedAt = new Date().toISOString();
    // All checks observe one committed snapshot while documents may be
    // validated concurrently. No locks on writers or ledger mutations.
    const results = await this.prisma.$transaction(
      integrityQueries.map(({ query }) =>
        this.prisma.$queryRaw<RawViolation[]>(query),
      ),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const checks = integrityQueries.map(({ name }, i) => ({
      name,
      ok: results[i].length === 0,
      violations: results[i].map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            typeof value === 'bigint' || Prisma.Decimal.isDecimal(value)
              ? Number(value)
              : value,
          ]),
        ),
      ),
    }));
    return { ok: checks.every((check) => check.ok), checkedAt, checks };
  }

  async asOf(query: AsOfQueryDto) {
    const at = new Date(query.at);
    if (!Number.isFinite(at.getTime()) || at.getTime() > Date.now()) {
      throw new BadRequestException(
        'at must be a valid datetime that is not in the future',
      );
    }
    const productId = query.productId ?? null;
    const rows = await this.prisma.$queryRaw<HistoricalRow[]>`
      WITH balances AS (
        SELECT m."productId", leg."locationId", SUM(leg.qty) AS qty
        FROM "StockMove" m
        CROSS JOIN LATERAL (VALUES
          (m."toLocationId", m.qty), (m."fromLocationId", -m.qty)
        ) AS leg("locationId", qty)
        WHERE m."doneAt" <= ${at}
          AND (${productId}::text IS NULL OR m."productId" = ${productId})
          AND leg."locationId" IS NOT NULL
        GROUP BY m."productId", leg."locationId"
      )
      SELECT p.id AS "productId", p.name, p.sku, p.uom,
             l.id AS "locationId", l.name AS "locationName",
             w.name AS "warehouseName", b.qty
      FROM balances b
      JOIN "Product" p ON p.id = b."productId"
      JOIN "Location" l ON l.id = b."locationId"
      JOIN "Warehouse" w ON w.id = l."warehouseId"
      ORDER BY p.name, p.sku, w.name, l.name, l.id`;

    const products = new Map<string, HistoricalProduct>();
    for (const row of rows) {
      let product = products.get(row.productId);
      if (!product) {
        product = {
          productId: row.productId,
          name: row.name,
          sku: row.sku,
          uom: row.uom,
          locations: [],
        };
        products.set(row.productId, product);
      }
      product.locations.push({
        locationId: row.locationId,
        locationName: row.locationName,
        warehouseName: row.warehouseName,
        qty: Number(row.qty),
      });
    }
    return { at: at.toISOString(), products: [...products.values()] };
  }
}
