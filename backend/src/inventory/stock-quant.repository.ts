import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { escapeLike } from './like';
import {
  LocationStock,
  StockFilter,
  StockKpis,
  StockRow,
  StockStatus,
} from './stock-row';

/**
 * Confirmed but not yet validated: deliveries in these statuses reserve stock,
 * receipts in them count as incoming. Drafts are only plans; DONE is on hand.
 */
export const OPEN_STATUSES = ['WAITING', 'READY'];

type Num = Prisma.Decimal;
interface RawRow {
  id: string;
  name: string;
  sku: string;
  uom: string;
  unitCost: Num;
  categoryId: string | null;
  categoryName: string | null;
  onHand: Num;
  reserved: Num;
  freeToUse: Num;
  incoming: Num;
  forecast: Num;
  minQty: Num | null;
  maxQty: Num | null;
  status: StockStatus;
  total: bigint;
}

const num = (v: Num | null): number | null => (v === null ? null : Number(v));

/**
 * All reads over the `stock_quant` view. The OK/LOW/OUT rule lives here, in
 * SQL, exactly once — lists, alerts and KPIs all use `rowsCte`.
 */
@Injectable()
export class StockQuantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRows(f: StockFilter): Promise<{ rows: StockRow[]; total: number }> {
    const statuses = f.statuses?.length ? f.statuses : null;
    const raw = await this.prisma.$queryRaw<RawRow[]>`
      ${this.rowsCte(f)}
      SELECT *, COUNT(*) OVER () AS total FROM rows
      WHERE (${statuses}::text[] IS NULL OR status = ANY(${statuses}::text[]))
      ORDER BY name
      LIMIT ${f.take ?? 1000}::int OFFSET ${f.skip ?? 0}::int`;
    return {
      rows: raw.map((r) => ({
        id: r.id,
        name: r.name,
        sku: r.sku,
        uom: r.uom,
        unitCost: Number(r.unitCost),
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        onHand: Number(r.onHand),
        reserved: Number(r.reserved),
        freeToUse: Number(r.freeToUse),
        incoming: Number(r.incoming),
        forecast: Number(r.forecast),
        minQty: num(r.minQty),
        maxQty: num(r.maxQty),
        status: r.status,
      })),
      total: raw.length ? Number(raw[0].total) : 0,
    };
  }

  async byLocation(productId: string): Promise<LocationStock[]> {
    const raw = await this.prisma.$queryRaw<
      { locationId: string; locationName: string; warehouseName: string; qty: Num }[]
    >`
      SELECT l.id AS "locationId", l.name AS "locationName",
             w.name AS "warehouseName", sq.qty
      FROM stock_quant sq
      JOIN "Location" l ON l.id = sq.location_id
      JOIN "Warehouse" w ON w.id = l."warehouseId"
      WHERE sq.product_id = ${productId} AND sq.qty <> 0
      ORDER BY w.name, l.name`;
    return raw.map((r) => ({ ...r, qty: Number(r.qty) }));
  }

  async kpis(): Promise<StockKpis> {
    const [k] = await this.prisma.$queryRaw<
      { inStock: bigint; low: bigint; outOfStock: bigint; value: Num }[]
    >`
      ${this.rowsCte({})}
      SELECT COUNT(*) FILTER (WHERE status <> 'OUT') AS "inStock",
             COUNT(*) FILTER (WHERE status = 'LOW') AS "low",
             COUNT(*) FILTER (WHERE status = 'OUT') AS "outOfStock",
             COALESCE(SUM("onHand" * "unitCost") FILTER (WHERE "onHand" > 0), 0) AS "value"
      FROM rows`;
    return {
      totalProductsInStock: Number(k.inStock),
      lowStock: Number(k.low),
      outOfStock: Number(k.outOfStock),
      stockValue: Number(k.value),
    };
  }

  /** Active products + derived on-hand, reservations, incoming and reorder rule. */
  private rowsCte(f: StockFilter): Prisma.Sql {
    const text = f.search?.trim();
    const search = text ? `%${escapeLike(text)}%` : null;
    const categoryId = f.categoryId ?? null;
    return Prisma.sql`
      WITH onhand AS (
        SELECT product_id, SUM(qty) AS qty FROM stock_quant GROUP BY product_id
      ),
      reserved AS (
        SELECT dl."productId" AS product_id, SUM(dl.qty) AS qty
        FROM "DeliveryLine" dl
        JOIN "Delivery" d ON d.id = dl."deliveryId"
        WHERE d.status::text IN (${Prisma.join(OPEN_STATUSES)})
        GROUP BY dl."productId"
      ),
      incoming AS (
        SELECT rl."productId" AS product_id, SUM(rl.qty) AS qty
        FROM "ReceiptLine" rl
        JOIN "Receipt" rc ON rc.id = rl."receiptId"
        WHERE rc.status::text IN (${Prisma.join(OPEN_STATUSES)})
        GROUP BY rl."productId"
      ),
      rows AS (
        SELECT p.id, p.name, p.sku, p.uom, p."unitCost",
               p."categoryId", c.name AS "categoryName",
               COALESCE(o.qty, 0) AS "onHand",
               COALESCE(r.qty, 0) AS reserved,
               COALESCE(o.qty, 0) - COALESCE(r.qty, 0) AS "freeToUse",
               COALESCE(i.qty, 0) AS incoming,
               COALESCE(o.qty, 0) + COALESCE(i.qty, 0) - COALESCE(r.qty, 0) AS forecast,
               rr."minQty", rr."maxQty",
               CASE
                 WHEN COALESCE(o.qty, 0) <= 0 THEN 'OUT'
                 WHEN rr."minQty" IS NOT NULL AND COALESCE(o.qty, 0) <= rr."minQty" THEN 'LOW'
                 ELSE 'OK'
               END AS status
        FROM "Product" p
        LEFT JOIN "Category" c ON c.id = p."categoryId"
        LEFT JOIN onhand o ON o.product_id = p.id
        LEFT JOIN reserved r ON r.product_id = p.id
        LEFT JOIN incoming i ON i.product_id = p.id
        LEFT JOIN "ReorderRule" rr ON rr."productId" = p.id
        WHERE p."isActive" = true
          AND (${search}::text IS NULL OR p.name ILIKE ${search} OR p.sku ILIKE ${search})
          AND (${categoryId}::text IS NULL OR p."categoryId" = ${categoryId})
      )`;
  }
}
