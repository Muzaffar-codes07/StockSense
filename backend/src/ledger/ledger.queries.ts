import { Prisma } from '@prisma/client';

const LIMIT = 50;

// Independent of stock_quant. Both legs of transfers are retained, including
// same-location moves, whose net contribution is zero.
const balances = Prisma.sql`
  WITH balances AS (
    SELECT m."productId", leg."locationId", SUM(leg.qty) AS qty
    FROM "StockMove" m
    CROSS JOIN LATERAL (VALUES
      (m."toLocationId", m.qty), (m."fromLocationId", -m.qty)
    ) AS leg("locationId", qty)
    WHERE leg."locationId" IS NOT NULL
    GROUP BY m."productId", leg."locationId"
  )`;

const documents = Prisma.sql`
  WITH documents AS (
    SELECT 'receipt' AS "docType", id AS "docId", status FROM "Receipt"
    UNION ALL SELECT 'delivery', id, status FROM "Delivery"
    UNION ALL SELECT 'transfer', id, status FROM "Transfer"
    UNION ALL SELECT 'adjustment', id, status FROM "Adjustment"
  )`;

export const integrityQueries = [
  {
    name: 'view-matches-ledger',
    query: Prisma.sql`
      ${balances}
      SELECT COALESCE(b."productId", q.product_id) AS "productId",
             COALESCE(b."locationId", q.location_id) AS "locationId",
             b.qty AS "ledgerQty", q.qty AS "viewQty"
      FROM balances b
      FULL OUTER JOIN stock_quant q
        ON q.product_id = b."productId" AND q.location_id = b."locationId"
      WHERE b.qty IS DISTINCT FROM q.qty
      ORDER BY "productId", "locationId"
      LIMIT ${LIMIT}`,
  },
  {
    name: 'no-negative-stock',
    query: Prisma.sql`
      ${balances}
      SELECT "productId", "locationId", qty FROM balances
      WHERE qty < 0
      ORDER BY "productId", "locationId"
      LIMIT ${LIMIT}`,
  },
  {
    name: 'posted-exactly-once',
    query: Prisma.sql`
      ${documents},
      expected AS (
        SELECT 'receipt' AS "docType", "receiptId" AS "docId", COUNT(*) AS qty
        FROM "ReceiptLine" GROUP BY "receiptId"
        UNION ALL
        SELECT 'delivery', "deliveryId", COUNT(*) FROM "DeliveryLine" GROUP BY "deliveryId"
        UNION ALL
        SELECT 'transfer', "transferId", COUNT(*) FROM "TransferLine" GROUP BY "transferId"
        UNION ALL
        SELECT 'adjustment', "adjustmentId", COUNT(*) FROM "AdjustmentLine"
        WHERE diff <> 0 GROUP BY "adjustmentId"
      ),
      actual AS (
        SELECT "docType", "docId", COUNT(*) AS qty FROM "StockMove"
        GROUP BY "docType", "docId"
      )
      SELECT d."docType", d."docId", COALESCE(e.qty, 0) AS expected,
             COALESCE(a.qty, 0) AS actual
      FROM documents d
      LEFT JOIN expected e USING ("docType", "docId")
      LEFT JOIN actual a USING ("docType", "docId")
      WHERE d.status = 'DONE' AND COALESCE(e.qty, 0) <> COALESCE(a.qty, 0)
      ORDER BY d."docType", d."docId"
      LIMIT ${LIMIT}`,
  },
  {
    name: 'no-orphan-moves',
    query: Prisma.sql`
      ${documents}
      SELECT m.id AS "moveId", m."docType", m."docId", d.status::text AS "documentStatus"
      FROM "StockMove" m
      LEFT JOIN documents d ON d."docType" = m."docType" AND d."docId" = m."docId"
      WHERE d.status IS DISTINCT FROM 'DONE'::"DocStatus"
        AND NOT (
          m."docType" IS NOT DISTINCT FROM 'initial'
          AND m."docId" IS NOT DISTINCT FROM m."productId"
          AND EXISTS (SELECT 1 FROM "Product" p WHERE p.id = m."docId")
        )
      ORDER BY m.id
      LIMIT ${LIMIT}`,
  },
  {
    name: 'moves-well-formed',
    query: Prisma.sql`
      SELECT id AS "moveId", "productId", qty, "fromLocationId", "toLocationId"
      FROM "StockMove"
      WHERE qty <= 0 OR ("fromLocationId" IS NULL AND "toLocationId" IS NULL)
      ORDER BY id
      LIMIT ${LIMIT}`,
  },
] as const;
