# Role 3 — Products & Stock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Products, categories, reorder rules and every "what's on hand" view (list, per-location, alerts, KPIs, Stock page) for StockSense.

**Architecture:** One SQL view (`stock_quant`) derives on-hand from the ledger; one repository query joins it with products, reservations and reorder rules and computes OK/LOW/OUT in SQL, so every screen and KPI reads the same numbers. NestJS modules `inventory` (reads), `products`, `categories`; React features `products` and `stock` built on Role 2's shared UI components.

**Tech Stack:** NestJS 10, Prisma 5 (`$queryRaw` for the view), PostgreSQL 16 (Docker), class-validator; React 18 + Vite, TanStack Query 5, React Hook Form 7 + Zod 3 (`@hookform/resolvers@^3.9`), Tailwind.

**Spec:** `docs/specs/2026-09-26-role-3-products-stock-design.md`

## Global Constraints

- Role 3 never writes stock numbers; stock changes only via `StockService.postMove()` (Role 1).
- Quantities: `Decimal(18,3)`; unit cost: `Decimal(12,2)`. API returns them as JS numbers.
- Every Role 3 route is protected with `@UseGuards(JwtAuthGuard)`; lists use `PaginationQueryDto` + `paginate()`; errors go through the shared `HttpExceptionFilter` (`{ success:false, statusCode, message }`).
- Stock status: `OUT` if on-hand ≤ 0; `LOW` if a reorder rule exists and on-hand ≤ `minQty`; else `OK`.
- Free to use = on-hand − Σ delivery-line qty where delivery status ∈ {`WAITING`, `READY`}.
- Archived products (`isActive = false`) never appear in lists, pickers, alerts or KPIs.
- Frontend screens use only Role 2's `Table`, `Modal`, `FormField`, `FilterBar`, `KpiCard` (+ the `SelectField` and `Pager` this plan adds to that library). No ad-hoc colours beyond Tailwind `slate`/`brand`/status colours.
- Commits: small, on `main`, `git pull --rebase` before every push, **no `Co-Authored-By` lines**.
- Frontend has no test runner: frontend tasks are verified by `npm run build -w frontend` (type-check) plus the listed manual browser checks.
- Spec deviations (deliberate): `GET /products` and `GET /stock` share one filter DTO with `status` (not `stockStatus`); an extra read endpoint `GET /stock/locations` lists all locations for pickers, so Role 3 does not wait on Role 1's warehouse API.

## Review Focus

1. **SKU typed with different case/whitespace** (`" steel-001 "` vs `"STEEL-001"`) — must be treated as the same SKU → 409. Test: Task 3 DTO spec.
2. **A product with no moves at all** — must still be listed with on-hand 0 and status `OUT` (not missing). Test: Task 2 DB spec.
3. **Search text containing `%` or `_`** — must match literally, not as a wildcard. Test: Task 2 `like.spec.ts` + DB spec.
4. **Archived product with stock** — must disappear from lists/KPIs while its moves stay in the ledger. Test: Task 2 DB spec.
5. **Deliveries in DRAFT/DONE** — must not reduce free-to-use; only WAITING/READY do. Test: Task 2 DB spec.

---

## File Structure

**Backend (`backend/`)**
| File | Responsibility |
|---|---|
| `prisma/schema.prisma` (modify) | `Product.unitCost`, `Product.isActive`, two `StockMove` composite indexes |
| `prisma/migrations/20260926110000_role3_products_stock/migration.sql` | Columns, indexes, `stock_quant` view |
| `jest.db.config.js`, `package.json` (modify) | `npm run test:db` for live-DB specs (`*.db-spec.ts`) |
| `src/common/prisma-errors.ts` | `isUniqueViolation`, `isForeignKeyViolation` |
| `src/inventory/stock-row.ts` | Shared types: `StockStatus`, `StockRow`, `StockFilter`, `LocationStock`, `LocationOption`, `StockKpis` |
| `src/inventory/like.ts` | `escapeLike()` |
| `src/inventory/stock-quant.repository.ts` | All raw SQL over `stock_quant` |
| `src/inventory/inventory.service.ts` | Pagination, alerts, KPIs, locations |
| `src/inventory/dto/stock-query.dto.ts` | `search`, `categoryId`, `status`, `page`, `pageSize` |
| `src/inventory/inventory.controller.ts`, `inventory.module.ts` | `/stock` routes |
| `src/products/sku.ts` | `normalizeSku`, `SKU_PATTERN` |
| `src/products/dto/product.dto.ts`, `dto/reorder-rule.dto.ts` | Validation |
| `src/products/products.service.ts`, `products.controller.ts`, `products.module.ts` | Product CRUD + initial stock + reorder rules |
| `src/categories/*` | Category CRUD |

**Frontend (`frontend/src/`)**
| File | Responsibility |
|---|---|
| `components/ui/SelectField.tsx`, `components/ui/Pager.tsx` (new, exported from `ui/index.ts`) | Shared select + pagination |
| `components/ui/FormField.tsx` (modify) | `forwardRef` so React Hook Form can register it |
| `lib/useDebouncedValue.ts` | Debounce search input |
| `features/stock/{types,api,hooks,format}.ts`, `StatusBadge.tsx` | Stock data layer + badge |
| `features/stock/StockPage.tsx`, `LowStockCard.tsx`, `UpdateStockModal.tsx` | Stock page, dashboard card, adjustment modal |
| `features/products/{types,api,hooks,schemas}.ts` | Products/categories data layer + Zod |
| `features/products/ProductsPage.tsx`, `ProductFormPage.tsx`, `CategoriesPanel.tsx` | Screens |
| `router.tsx`, `components/layout/Sidebar.tsx` (modify) | Routes + **Stock** nav item |

---

### Task 1: Schema additions + live database

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `Product`, model `StockMove`)
- Create: `backend/prisma/migrations/20260926110000_role3_products_stock/migration.sql`

**Interfaces:**
- Produces: columns `"Product"."unitCost"` (numeric 12,2), `"Product"."isActive"` (bool); view `stock_quant(product_id text, location_id text, qty numeric)`.

- [ ] **Step 1: Check whether Tuhin already pushed these changes**

Run: `git pull --rebase && grep -n "unitCost\|isActive" backend/prisma/schema.prisma; grep -rln "stock_quant" backend/prisma/migrations`
If both `unitCost` and a migration containing `stock_quant` exist → skip to Step 5. If only some exist → stop and reconcile with Tuhin (never add a second copy of a column).

- [ ] **Step 2: Edit `schema.prisma`**

In `model Product`, directly under the `uom` line add:
```prisma
  unitCost   Decimal  @default(0) @db.Decimal(12, 2) // per-unit cost (Stock page, stock value KPI)
  isActive   Boolean  @default(true) // archive instead of delete: moves reference products
```
In `model StockMove`, after the existing `@@index` lines add:
```prisma
  @@index([productId, toLocationId])
  @@index([productId, fromLocationId])
```

- [ ] **Step 3: Write the migration**

`backend/prisma/migrations/20260926110000_role3_products_stock/migration.sql`:
```sql
-- Role 3: product cost + archive flag
ALTER TABLE "Product"
  ADD COLUMN "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Composite indexes serving stock_quant's per-(product, location) grouping
CREATE INDEX "StockMove_productId_toLocationId_idx" ON "StockMove"("productId", "toLocationId");
CREATE INDEX "StockMove_productId_fromLocationId_idx" ON "StockMove"("productId", "fromLocationId");

-- On-hand per product and location, derived from the ledger:
-- moves INTO a location count positive, moves OUT OF it count negative.
-- Not declared in schema.prisma on purpose; read via $queryRaw.
CREATE VIEW stock_quant AS
SELECT product_id, location_id, SUM(qty) AS qty FROM (
  SELECT "productId" AS product_id, "toLocationId" AS location_id, qty
    FROM "StockMove" WHERE "toLocationId" IS NOT NULL
  UNION ALL
  SELECT "productId", "fromLocationId", -qty
    FROM "StockMove" WHERE "fromLocationId" IS NOT NULL
) m
GROUP BY product_id, location_id;
```

- [ ] **Step 4: Validate and regenerate the client**

Run: `cd backend && npx prisma validate && npx prisma generate`
Expected: `The schema at prisma\schema.prisma is valid 🚀` and `Generated Prisma Client`.

- [ ] **Step 5: Bring up the database and apply migrations (PHASE-0 Gate A)**

Run (repo root, Bash):
```bash
[ -f .env ] || cp .env.example .env
[ -f backend/.env ] || cp backend/.env.example backend/.env
npm install
docker compose up -d db
cd backend && npx prisma migrate deploy && npx prisma generate
```
Expected: `All migrations have been successfully applied.` (lists `..._init` and `..._role3_products_stock`).

- [ ] **Step 6: Prove the schema and the database agree, and the view exists**

Run: `cd backend && npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code`
Expected: `No difference detected.` (exit 0).
Run: `docker compose exec db psql -U stocksense -c "SELECT * FROM stock_quant LIMIT 1;"`
Expected: header `product_id | location_id | qty` and `(0 rows)`.

- [ ] **Step 7: Seed once and confirm ledger tests still pass**

Run: `cd backend && npm run prisma:seed && npm test`
Expected: `Seed complete. Login: admin@stocksense.dev / password123` and `Tests: 7 passed`.

- [ ] **Step 8: Commit (skip if Step 1 found Tuhin's commit)**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260926110000_role3_products_stock
git commit -m "feat(db): add product cost/archive flag and stock_quant view"
git pull --rebase && git push
```

---

### Task 2: Stock read layer (`/stock` API)

**Files:**
- Create: `backend/src/inventory/stock-row.ts`, `like.ts`, `stock-quant.repository.ts`, `inventory.service.ts`, `dto/stock-query.dto.ts`, `inventory.controller.ts`, `inventory.module.ts`
- Create: `backend/jest.db.config.js`; Modify: `backend/package.json` (scripts)
- Modify: `backend/src/app.module.ts`
- Test: `backend/src/inventory/like.spec.ts`, `backend/src/inventory/stock-quant.db-spec.ts`

**Interfaces:**
- Consumes: view `stock_quant` (Task 1); `StockService.postMove()` (Role 1) in the DB spec.
- Produces:
  - `StockQuantRepository.findRows(f: StockFilter): Promise<{ rows: StockRow[]; total: number }>`
  - `StockQuantRepository.byLocation(productId: string): Promise<LocationStock[]>`
  - `StockQuantRepository.kpis(): Promise<StockKpis>`
  - `InventoryService.list(q: StockQueryDto): Promise<Paginated<StockRow>>`, `.alerts(): Promise<StockRow[]>`, `.kpis(): Promise<StockKpis>`, `.locations(productId: string): Promise<LocationStock[]>`, `.allLocations(): Promise<LocationOption[]>`
  - `InventoryModule` exports `InventoryService`.
  - HTTP: `GET /stock`, `GET /stock/alerts`, `GET /stock/kpis`, `GET /stock/locations`, `GET /stock/:productId/locations`

- [ ] **Step 1: Write the failing unit test for `escapeLike`**

`backend/src/inventory/like.spec.ts`:
```ts
import { escapeLike } from './like';

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character itself', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('leaves ordinary text unchanged', () => {
    expect(escapeLike('Steel Rods-001')).toBe('Steel Rods-001');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd backend && npx jest src/inventory/like.spec.ts`
Expected: FAIL — `Cannot find module './like'`.

- [ ] **Step 3: Implement `like.ts` and the shared types**

`backend/src/inventory/like.ts`:
```ts
/**
 * Escapes LIKE/ILIKE wildcards (`%`, `_`) and the escape character so user
 * search text matches literally. Postgres uses backslash as the default escape.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
```

`backend/src/inventory/stock-row.ts`:
```ts
export type StockStatus = 'OK' | 'LOW' | 'OUT';
export const STOCK_STATUSES: StockStatus[] = ['OK', 'LOW', 'OUT'];

/** One active product with its derived stock figures. */
export interface StockRow {
  id: string;
  name: string;
  sku: string;
  uom: string;
  unitCost: number;
  categoryId: string | null;
  categoryName: string | null;
  onHand: number;
  reserved: number;
  freeToUse: number;
  minQty: number | null;
  maxQty: number | null;
  status: StockStatus;
}

export interface StockFilter {
  search?: string;
  categoryId?: string;
  statuses?: StockStatus[];
  skip?: number;
  take?: number;
}

export interface LocationStock {
  locationId: string;
  locationName: string;
  warehouseName: string;
  qty: number;
}

export interface LocationOption {
  id: string;
  name: string;
  type: string;
  warehouseName: string;
}

export interface StockKpis {
  totalProductsInStock: number;
  lowStock: number;
  outOfStock: number;
  stockValue: number;
}
```

- [ ] **Step 4: Run the unit test to see it pass**

Run: `cd backend && npx jest src/inventory/like.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the live-DB test runner**

`backend/jest.db.config.js`:
```js
// Live-database specs (*.db-spec.ts). Needs `docker compose up -d db` + migrations.
// Kept out of `npm test` so unit tests never need a database.
module.exports = {
  ...require('./jest.config'),
  testRegex: '.*\\.db-spec\\.ts$',
};
```
In `backend/package.json` `scripts`, after `"test": "jest",` add:
```json
    "test:db": "jest -c jest.db.config.js --runInBand",
```

- [ ] **Step 6: Write the failing DB spec**

`backend/src/inventory/stock-quant.db-spec.ts`:
```ts
import { MoveType, PrismaClient } from '@prisma/client';
import { StockService } from '../stock/stock.service';
import { StockQuantRepository } from './stock-quant.repository';

// Runs the brief's demo flow against the real database and checks every
// derived figure. Creates its own uniquely-tagged rows and removes them after.
describe('stock_quant + StockQuantRepository (live DB)', () => {
  const prisma = new PrismaClient();
  const stock = new StockService(prisma as never);
  const repo = new StockQuantRepository(prisma as never);
  const tag = `T${Date.now()}`;
  let warehouseId: string;
  let mainStore: string;
  let rack: string;
  let steel: string;
  let idle: string;
  let archived: string;

  beforeAll(async () => {
    warehouseId = (await prisma.warehouse.create({ data: { name: `${tag} WH` } })).id;
    mainStore = (await prisma.location.create({ data: { warehouseId, name: 'Main Store' } })).id;
    rack = (
      await prisma.location.create({
        data: { warehouseId, name: 'Production Rack', type: 'PRODUCTION' },
      })
    ).id;
    steel = (
      await prisma.product.create({
        data: { name: `${tag} Steel`, sku: `${tag}-STEEL`, uom: 'kg', unitCost: 10 },
      })
    ).id;
    idle = (await prisma.product.create({ data: { name: `${tag} Idle`, sku: `${tag}-IDLE` } })).id;
    archived = (
      await prisma.product.create({
        data: { name: `${tag} Old`, sku: `${tag}-OLD`, isActive: false },
      })
    ).id;
    await prisma.reorderRule.create({ data: { productId: steel, minQty: 80 } });

    // Receive 100 -> move 30 to the rack -> deliver 20 from the rack -> 3 damaged
    await stock.postMove({ productId: steel, qty: 100, moveType: MoveType.RECEIPT, toLocationId: mainStore });
    await stock.postMove({ productId: steel, qty: 30, moveType: MoveType.INTERNAL, fromLocationId: mainStore, toLocationId: rack });
    await stock.postMove({ productId: steel, qty: 20, moveType: MoveType.DELIVERY, fromLocationId: rack });
    await stock.postMove({ productId: steel, qty: 3, moveType: MoveType.ADJUSTMENT, fromLocationId: mainStore });
    await stock.postMove({ productId: archived, qty: 5, moveType: MoveType.RECEIPT, toLocationId: mainStore });
  });

  afterAll(async () => {
    const ids = [steel, idle, archived];
    await prisma.stockMove.deleteMany({ where: { productId: { in: ids } } });
    await prisma.reorderRule.deleteMany({ where: { productId: { in: ids } } });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
    await prisma.location.deleteMany({ where: { warehouseId } });
    await prisma.warehouse.delete({ where: { id: warehouseId } });
    await prisma.$disconnect();
  });

  it('totals the demo flow to exactly 77', async () => {
    const { rows } = await repo.findRows({ search: `${tag} Steel` });
    expect(rows).toHaveLength(1);
    expect(rows[0].onHand).toBe(77);
  });

  it('splits stock per location: 67 in Main Store, 10 on the rack', async () => {
    const locations = await repo.byLocation(steel);
    expect(locations.map((l) => [l.locationName, l.qty])).toEqual([
      ['Main Store', 67],
      ['Production Rack', 10],
    ]);
  });

  it('lists products with no moves as OUT, flags LOW at/under the minimum, hides archived', async () => {
    const { rows, total } = await repo.findRows({ search: tag });
    expect(total).toBe(2);
    expect(Object.fromEntries(rows.map((r) => [r.name, r.status]))).toEqual({
      [`${tag} Idle`]: 'OUT',
      [`${tag} Steel`]: 'LOW',
    });
  });

  it('filters by status', async () => {
    const { rows, total } = await repo.findRows({ search: tag, statuses: ['OUT'] });
    expect(total).toBe(1);
    expect(rows[0].name).toBe(`${tag} Idle`);
  });

  it('counts KPIs including this data', async () => {
    const k = await repo.kpis();
    expect(k.lowStock).toBeGreaterThanOrEqual(1);
    expect(k.outOfStock).toBeGreaterThanOrEqual(1);
    expect(k.totalProductsInStock).toBeGreaterThanOrEqual(1);
    expect(k.stockValue).toBeGreaterThanOrEqual(770); // 77 kg x 10
  });

  it('subtracts only WAITING/READY deliveries from free-to-use', async () => {
    const ready = await prisma.delivery.create({
      data: { status: 'READY', lines: { create: { productId: steel, qty: 7 } } },
    });
    const draft = await prisma.delivery.create({
      data: { status: 'DRAFT', lines: { create: { productId: steel, qty: 100 } } },
    });
    try {
      const { rows } = await repo.findRows({ search: `${tag} Steel` });
      expect(rows[0].reserved).toBe(7);
      expect(rows[0].freeToUse).toBe(70);
    } finally {
      await prisma.delivery.deleteMany({ where: { id: { in: [ready.id, draft.id] } } });
    }
  });

  it('treats % in search text literally', async () => {
    const { rows } = await repo.findRows({ search: '%' });
    expect(rows).toHaveLength(0);
  });

  it('is OK once on-hand is above the minimum', async () => {
    await prisma.reorderRule.update({ where: { productId: steel }, data: { minQty: 50 } });
    const { rows } = await repo.findRows({ search: `${tag} Steel` });
    expect(rows[0].status).toBe('OK');
  });
});
```

- [ ] **Step 7: Run it to see it fail**

Run: `cd backend && npm run test:db`
Expected: FAIL — `Cannot find module './stock-quant.repository'`.

- [ ] **Step 8: Implement the repository**

`backend/src/inventory/stock-quant.repository.ts`:
```ts
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

/** Delivery statuses whose quantities are promised but not yet shipped. */
export const RESERVING_STATUSES = ['WAITING', 'READY'];

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

  /** Active products + derived on-hand, reservations and reorder rule. */
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
        WHERE d.status::text IN (${Prisma.join(RESERVING_STATUSES)})
        GROUP BY dl."productId"
      ),
      rows AS (
        SELECT p.id, p.name, p.sku, p.uom, p."unitCost",
               p."categoryId", c.name AS "categoryName",
               COALESCE(o.qty, 0) AS "onHand",
               COALESCE(r.qty, 0) AS reserved,
               COALESCE(o.qty, 0) - COALESCE(r.qty, 0) AS "freeToUse",
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
        LEFT JOIN "ReorderRule" rr ON rr."productId" = p.id
        WHERE p."isActive" = true
          AND (${search}::text IS NULL OR p.name ILIKE ${search} OR p.sku ILIKE ${search})
          AND (${categoryId}::text IS NULL OR p."categoryId" = ${categoryId})
      )`;
  }
}
```

- [ ] **Step 9: Run the DB spec to see it pass**

Run: `cd backend && npm run test:db`
Expected: PASS (8 tests). If `LIMIT` complains about types, the `::int` casts are missing.

- [ ] **Step 10: Add DTO, service, controller, module**

`backend/src/inventory/dto/stock-query.dto.ts`:
```ts
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { STOCK_STATUSES, StockStatus } from '../stock-row';

// GET /stock and GET /products: ?search&categoryId&status&page&pageSize
export class StockQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('all', { message: 'categoryId must be a valid id' })
  categoryId?: string;

  @IsOptional()
  @IsIn(STOCK_STATUSES, { message: 'status must be one of OK, LOW, OUT' })
  status?: StockStatus;
}
```

`backend/src/inventory/inventory.service.ts`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Paginated, paginate, toSkipTake } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { StockQueryDto } from './dto/stock-query.dto';
import { StockQuantRepository } from './stock-quant.repository';
import { LocationOption, LocationStock, StockKpis, StockRow } from './stock-row';

const ALERT_LIMIT = 50;

@Injectable()
export class InventoryService {
  constructor(
    private readonly repo: StockQuantRepository,
    private readonly prisma: PrismaService,
  ) {}

  async list(q: StockQueryDto): Promise<Paginated<StockRow>> {
    const { skip, take } = toSkipTake(q);
    const { rows, total } = await this.repo.findRows({
      search: q.search,
      categoryId: q.categoryId,
      statuses: q.status ? [q.status] : undefined,
      skip,
      take,
    });
    return paginate(rows, total, q);
  }

  async alerts(): Promise<StockRow[]> {
    const { rows } = await this.repo.findRows({ statuses: ['OUT', 'LOW'], take: ALERT_LIMIT });
    return rows;
  }

  kpis(): Promise<StockKpis> {
    return this.repo.kpis();
  }

  async locations(productId: string): Promise<LocationStock[]> {
    const exists = await this.prisma.product.count({ where: { id: productId } });
    if (!exists) throw new NotFoundException('Product not found');
    return this.repo.byLocation(productId);
  }

  async allLocations(): Promise<LocationOption[]> {
    const locations = await this.prisma.location.findMany({
      orderBy: [{ warehouse: { name: 'asc' } }, { name: 'asc' }],
      select: { id: true, name: true, type: true, warehouse: { select: { name: true } } },
    });
    return locations.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      warehouseName: l.warehouse.name,
    }));
  }
}
```

`backend/src/inventory/inventory.controller.ts`:
```ts
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StockQueryDto } from './dto/stock-query.dto';
import { InventoryService } from './inventory.service';

@UseGuards(JwtAuthGuard)
@Controller('stock')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(@Query() q: StockQueryDto) {
    return this.inventory.list(q);
  }

  @Get('alerts')
  alerts() {
    return this.inventory.alerts();
  }

  @Get('kpis')
  kpis() {
    return this.inventory.kpis();
  }

  @Get('locations')
  allLocations() {
    return this.inventory.allLocations();
  }

  @Get(':productId/locations')
  locations(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.inventory.locations(productId);
  }
}
```

`backend/src/inventory/inventory.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StockQuantRepository } from './stock-quant.repository';

// Read-only stock views (Role 3). Everything here derives from the ledger.
@Module({
  imports: [AuthModule],
  controllers: [InventoryController],
  providers: [StockQuantRepository, InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
```

In `backend/src/app.module.ts` add `import { InventoryModule } from './inventory/inventory.module';` and add `InventoryModule,` to `imports` after `AuthModule,`.

- [ ] **Step 11: Build and smoke-test the endpoints**

Run: `cd backend && npm run build && npm test`
Expected: build succeeds; unit tests pass (7 ledger + 2 like).
Run the API (`npm run start:dev` in another terminal), then:
```bash
TOKEN=$(curl -s -X POST localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@stocksense.dev","password":"password123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
curl -s localhost:3000/stock -H "Authorization: Bearer $TOKEN"
curl -s localhost:3000/stock/kpis -H "Authorization: Bearer $TOKEN"
curl -s "localhost:3000/stock?status=BAD" -H "Authorization: Bearer $TOKEN"
curl -s localhost:3000/stock
```
Expected: a `{ data:[...Steel Rods, Office Chair...], total:2, ... }` page; a KPI object; `400` with `"status must be one of OK, LOW, OUT"`; `401 Missing bearer token`.

- [ ] **Step 12: Commit**

```bash
git add backend/src/inventory backend/src/app.module.ts backend/jest.db.config.js backend/package.json
git commit -m "feat(stock): stock_quant-backed stock list, alerts, KPIs and per-location API"
git pull --rebase && git push
```

---

### Task 3: Products API (CRUD, initial stock, reorder rules)

**Files:**
- Create: `backend/src/common/prisma-errors.ts`, `backend/src/products/sku.ts`, `backend/src/products/dto/product.dto.ts`, `backend/src/products/dto/reorder-rule.dto.ts`, `backend/src/products/products.service.ts`, `backend/src/products/products.controller.ts`, `backend/src/products/products.module.ts`
- Modify: `backend/src/app.module.ts`, `backend/package.json` (dependency)
- Test: `backend/src/products/dto/product.dto.spec.ts`, `backend/src/products/products.service.spec.ts`

**Interfaces:**
- Consumes: `InventoryService.list/locations` (Task 2); `StockService.postMove(input, tx)` (Role 1); `StockQueryDto` (Task 2); `CurrentUser`/`AuthUser` (`user.sub` = user id).
- Produces:
  - `isUniqueViolation(e: unknown): boolean`, `isForeignKeyViolation(e: unknown): boolean` (common)
  - `SKU_TAKEN = 'SKU already exists'` (exported from `products.service.ts`; the frontend matches this exact text)
  - `ProductDetail` = `{ id, name, sku, uom, unitCost: number, isActive, category: {id,name}|null, reorderRule: {minQty:number,maxQty:number|null}|null, locations: LocationStock[], createdAt, updatedAt }`
  - HTTP: `GET /products` (same `Paginated<StockRow>` as `/stock`), `GET /products/:id` → `ProductDetail`, `POST /products` → `ProductDetail`, `PATCH /products/:id` → `ProductDetail`, `DELETE /products/:id` → 204, `PUT /products/:id/reorder-rule` → `{minQty,maxQty}`, `DELETE /products/:id/reorder-rule` → 204

- [ ] **Step 1: Install the mapped-types helper**

Run: `npm install @nestjs/mapped-types@^2.0.5 -w backend`
Expected: added to `backend/package.json` dependencies.

- [ ] **Step 2: Write the failing DTO validation spec**

`backend/src/products/dto/product.dto.spec.ts`:
```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto } from './product.dto';

async function check(body: object) {
  const dto = plainToInstance(CreateProductDto, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, fields: errors.map((e) => e.property) };
}

describe('CreateProductDto', () => {
  it('normalises SKU case and whitespace so " steel-001 " and "STEEL-001" collide', async () => {
    const { dto, fields } = await check({ name: ' Steel Rods ', sku: ' steel-001 ' });
    expect(fields).toEqual([]);
    expect(dto.sku).toBe('STEEL-001');
    expect(dto.name).toBe('Steel Rods');
  });

  it('rejects SKUs with spaces or symbols', async () => {
    expect((await check({ name: 'Steel', sku: 'ST EEL' })).fields).toEqual(['sku']);
    expect((await check({ name: 'Steel', sku: 'STEEL#1' })).fields).toEqual(['sku']);
  });

  it('rejects a blank name', async () => {
    expect((await check({ name: '   ', sku: 'A1' })).fields).toEqual(['name']);
  });

  it('rejects an unknown unit of measure and a negative cost', async () => {
    const { fields } = await check({ name: 'Steel', sku: 'A1', uom: 'bags', unitCost: -1 });
    expect(fields.sort()).toEqual(['unitCost', 'uom']);
  });

  it('rejects initial stock with more than 3 decimals or zero', async () => {
    expect((await check({ name: 'S', sku: 'A1', initialStock: { qty: 1.0005 } })).fields).toEqual(['initialStock']);
    expect((await check({ name: 'S', sku: 'A1', initialStock: { qty: 0 } })).fields).toEqual(['initialStock']);
  });

  it('accepts a full valid product', async () => {
    const { fields } = await check({
      name: 'Steel', sku: 'STEEL-001', uom: 'kg', unitCost: 12.5,
      initialStock: { qty: 100.25 },
    });
    expect(fields).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `cd backend && npx jest src/products/dto`
Expected: FAIL — `Cannot find module './product.dto'`.

- [ ] **Step 4: Implement SKU helpers and DTOs**

`backend/src/products/sku.ts`:
```ts
/** SKUs are case-insensitive identifiers: trim and upper-case before storing. */
export function normalizeSku(raw: string): string {
  return raw.trim().toUpperCase();
}

/** 1-32 chars, starts with a letter/digit, then letters, digits, `.`, `_`, `-`. */
export const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
```

`backend/src/products/dto/product.dto.ts`:
```ts
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { normalizeSku, SKU_PATTERN } from '../sku';

export const UOMS = ['unit', 'kg', 'g', 'l', 'ml', 'm', 'box'] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class InitialStockDto {
  @IsNumber(
    { maxDecimalPlaces: 3 },
    { message: 'Initial quantity must be a number with at most 3 decimals' },
  )
  @Min(0.001, { message: 'Initial quantity must be greater than 0' })
  qty!: number;

  @IsOptional()
  @IsUUID('all', { message: 'Pick a valid location' })
  locationId?: string;
}

export class CreateProductDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(120, { message: 'Name must be at most 120 characters' })
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? normalizeSku(value) : value))
  @IsString()
  @Matches(SKU_PATTERN, {
    message: 'SKU must be 1-32 letters, digits, dot, dash or underscore',
  })
  sku!: string;

  @IsOptional()
  @IsUUID('all', { message: 'Pick a valid category' })
  categoryId?: string | null;

  @IsOptional()
  @IsIn(UOMS, { message: `Unit must be one of: ${UOMS.join(', ')}` })
  uom?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Unit cost must have at most 2 decimals' })
  @Min(0, { message: 'Unit cost cannot be negative' })
  unitCost?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => InitialStockDto)
  initialStock?: InitialStockDto;
}

// Initial stock only makes sense at creation; later changes go through operations.
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['initialStock'] as const),
) {}
```

`backend/src/products/dto/reorder-rule.dto.ts`:
```ts
import { IsNumber, IsOptional, Min } from 'class-validator';

export class ReorderRuleDto {
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Minimum must be a number with at most 3 decimals' })
  @Min(0, { message: 'Minimum cannot be negative' })
  minQty!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Maximum must be a number with at most 3 decimals' })
  @Min(0, { message: 'Maximum cannot be negative' })
  maxQty?: number | null;
}
```

- [ ] **Step 5: Run the DTO spec to see it pass**

Run: `cd backend && npx jest src/products/dto`
Expected: PASS (6 tests).

- [ ] **Step 6: Write the failing service spec**

`backend/src/products/products.service.spec.ts`:
```ts
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
```

- [ ] **Step 7: Run it to see it fail**

Run: `cd backend && npx jest src/products/products.service.spec.ts`
Expected: FAIL — `Cannot find module './products.service'`.

- [ ] **Step 8: Implement Prisma error helpers and the service**

`backend/src/common/prisma-errors.ts`:
```ts
import { Prisma } from '@prisma/client';

/** A write hit a unique constraint (Prisma P2002). */
export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

/** A write referenced a row that does not exist (Prisma P2003). */
export function isForeignKeyViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003';
}
```

`backend/src/products/products.service.ts`:
```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LocationType, MoveType, Prisma } from '@prisma/client';
import { isForeignKeyViolation, isUniqueViolation } from '../common/prisma-errors';
import { StockQueryDto } from '../inventory/dto/stock-query.dto';
import { InventoryService } from '../inventory/inventory.service';
import { LocationStock } from '../inventory/stock-row';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ReorderRuleDto } from './dto/reorder-rule.dto';

export const SKU_TAKEN = 'SKU already exists';

export interface ReorderRuleView {
  minQty: number;
  maxQty: number | null;
}

export interface ProductDetail {
  id: string;
  name: string;
  sku: string;
  uom: string;
  unitCost: number;
  isActive: boolean;
  category: { id: string; name: string } | null;
  reorderRule: ReorderRuleView | null;
  locations: LocationStock[];
  createdAt: Date;
  updatedAt: Date;
}

const toRuleView = (r: { minQty: Prisma.Decimal; maxQty: Prisma.Decimal | null }): ReorderRuleView => ({
  minQty: Number(r.minQty),
  maxQty: r.maxQty === null ? null : Number(r.maxQty),
});

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly inventory: InventoryService,
  ) {}

  list(q: StockQueryDto) {
    return this.inventory.list(q);
  }

  async findOne(id: string): Promise<ProductDetail> {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, reorderRules: true },
    });
    if (!p) throw new NotFoundException('Product not found');
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      uom: p.uom,
      unitCost: Number(p.unitCost),
      isActive: p.isActive,
      category: p.category ? { id: p.category.id, name: p.category.name } : null,
      reorderRule: p.reorderRules[0] ? toRuleView(p.reorderRules[0]) : null,
      locations: await this.inventory.locations(id),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  /** Creates the product and, optionally, its opening stock — atomically. */
  async create(dto: CreateProductDto, userId: string): Promise<ProductDetail> {
    const { initialStock, ...data } = dto;
    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({ data });
        if (initialStock) {
          const toLocationId =
            initialStock.locationId ?? (await this.defaultStockLocationId(tx));
          await this.stock.postMove(
            {
              productId: created.id,
              qty: initialStock.qty,
              moveType: MoveType.ADJUSTMENT,
              toLocationId,
              docType: 'initial',
              docId: created.id,
              createdById: userId,
            },
            tx,
          );
        }
        return created;
      });
      return this.findOne(product.id);
    } catch (e) {
      throw this.translate(e);
    }
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDetail> {
    await this.ensureExists(id);
    try {
      await this.prisma.product.update({ where: { id }, data: dto });
    } catch (e) {
      throw this.translate(e);
    }
    return this.findOne(id);
  }

  /** Archived products keep their ledger history but leave every list. */
  async archive(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  async setReorderRule(id: string, dto: ReorderRuleDto): Promise<ReorderRuleView> {
    const maxQty = dto.maxQty ?? null;
    if (maxQty !== null && maxQty < dto.minQty) {
      throw new BadRequestException('Maximum must be greater than or equal to minimum');
    }
    await this.ensureExists(id);
    const rule = await this.prisma.reorderRule.upsert({
      where: { productId: id },
      create: { productId: id, minQty: dto.minQty, maxQty },
      update: { minQty: dto.minQty, maxQty },
    });
    return toRuleView(rule);
  }

  async removeReorderRule(id: string): Promise<void> {
    await this.prisma.reorderRule.deleteMany({ where: { productId: id } });
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.product.count({ where: { id } });
    if (!count) throw new NotFoundException('Product not found');
  }

  private async defaultStockLocationId(tx: Prisma.TransactionClient): Promise<string> {
    const location = await tx.location.findFirst({
      where: { type: LocationType.STOCK },
      orderBy: { name: 'asc' },
      select: { id: true },
    });
    if (!location) {
      throw new BadRequestException('Create a stock location before adding initial stock');
    }
    return location.id;
  }

  private translate(e: unknown): unknown {
    if (isUniqueViolation(e)) return new ConflictException(SKU_TAKEN);
    if (isForeignKeyViolation(e)) return new BadRequestException('Category or location not found');
    return e;
  }
}
```

- [ ] **Step 9: Run the service spec to see it pass**

Run: `cd backend && npx jest src/products`
Expected: PASS (6 DTO + 9 service tests).

- [ ] **Step 10: Controller + module + wiring**

`backend/src/products/products.controller.ts`:
```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { StockQueryDto } from '../inventory/dto/stock-query.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ReorderRuleDto } from './dto/reorder-rule.dto';
import { ProductsService } from './products.service';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() q: StockQueryDto) {
    return this.products.list(q);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthUser) {
    return this.products.create(dto, user.sub);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.archive(id);
  }

  @Put(':id/reorder-rule')
  setReorderRule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReorderRuleDto) {
    return this.products.setReorderRule(id, dto);
  }

  @Delete(':id/reorder-rule')
  @HttpCode(204)
  removeReorderRule(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.removeReorderRule(id);
  }
}
```

`backend/src/products/products.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { StockModule } from '../stock/stock.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [AuthModule, StockModule, InventoryModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
```

In `backend/src/app.module.ts` add `import { ProductsModule } from './products/products.module';` and `ProductsModule,` to `imports`.

- [ ] **Step 11: Build and smoke-test**

Run: `cd backend && npm run build && npm test` → build OK, all unit tests pass.
With the API running and `TOKEN` set as in Task 2 Step 11:
```bash
curl -s -X POST localhost:3000/products -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Desk","sku":" desk-001 ","uom":"unit","unitCost":3000,"initialStock":{"qty":50}}'
curl -s -X POST localhost:3000/products -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Desk 2","sku":"DESK-001"}'
curl -s "localhost:3000/products?search=desk" -H "Authorization: Bearer $TOKEN"
```
Expected: detail with `"sku":"DESK-001"`, `"unitCost":3000`, `locations:[{"locationName":"Main Store","qty":50,...}]`; then `409 "SKU already exists"`; then a page whose Desk row has `"onHand":50,"status":"OK"`.

- [ ] **Step 12: Commit**

```bash
git add backend/src/common/prisma-errors.ts backend/src/products backend/src/app.module.ts backend/package.json package-lock.json
git commit -m "feat(products): product CRUD with atomic initial stock and reorder rules"
git pull --rebase && git push
```
Tell Role 4: `GET /products?search=` (active only) is live for line-item pickers.

---

### Task 4: Categories API

**Files:**
- Create: `backend/src/categories/dto/category.dto.ts`, `categories.service.ts`, `categories.controller.ts`, `categories.module.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/src/categories/categories.service.spec.ts`

**Interfaces:**
- Consumes: `isUniqueViolation` (Task 3).
- Produces: `GET /categories` → `{ id, name, productCount }[]`; `POST /categories` `{name}` → `{id,name}`; `PATCH /categories/:id` `{name}` → `{id,name}`; `DELETE /categories/:id` → 204.

- [ ] **Step 1: Write the failing spec**

`backend/src/categories/categories.service.spec.ts`:
```ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CategoriesService } from './categories.service';

function make() {
  const prisma = {
    category: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'c1', name: 'Raw Materials', _count: { products: 2 } },
      ]),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'c2', name: 'Tools' }),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  return { prisma, service: new CategoriesService(prisma as never) };
}

describe('CategoriesService', () => {
  it('lists categories with product counts', async () => {
    const { service } = make();
    expect(await service.list()).toEqual([{ id: 'c1', name: 'Raw Materials', productCount: 2 }]);
  });

  it('turns a duplicate name into a 409', async () => {
    const { prisma, service } = make();
    prisma.category.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(service.create({ name: 'Tools' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to delete a category that still has products', async () => {
    const { prisma, service } = make();
    prisma.category.findUnique.mockResolvedValue({ id: 'c1', _count: { products: 2 } });
    await expect(service.remove('c1')).rejects.toThrow(
      'This category still has 2 product(s); move them to another category first',
    );
    expect(prisma.category.delete).not.toHaveBeenCalled();
  });

  it('deletes an empty category', async () => {
    const { prisma, service } = make();
    prisma.category.findUnique.mockResolvedValue({ id: 'c1', _count: { products: 0 } });
    await service.remove('c1');
    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('404s for a missing category', async () => {
    const { prisma, service } = make();
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(service.remove('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd backend && npx jest src/categories`
Expected: FAIL — `Cannot find module './categories.service'`.

- [ ] **Step 3: Implement DTO + service**

`backend/src/categories/dto/category.dto.ts`:
```ts
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CategoryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MaxLength(60, { message: 'Category name must be at most 60 characters' })
  name!: string;
}
```

`backend/src/categories/categories.service.ts`:
```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryDto } from './dto/category.dto';

const NAME_TAKEN = 'A category with this name already exists';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return categories.map((c) => ({ id: c.id, name: c.name, productCount: c._count.products }));
  }

  async create(dto: CategoryDto) {
    try {
      return await this.prisma.category.create({ data: { name: dto.name } });
    } catch (e) {
      throw isUniqueViolation(e) ? new ConflictException(NAME_TAKEN) : e;
    }
  }

  async update(id: string, dto: CategoryDto) {
    await this.find(id);
    try {
      return await this.prisma.category.update({ where: { id }, data: { name: dto.name } });
    } catch (e) {
      throw isUniqueViolation(e) ? new ConflictException(NAME_TAKEN) : e;
    }
  }

  async remove(id: string): Promise<void> {
    const category = await this.find(id);
    const count = category._count.products;
    if (count > 0) {
      throw new ConflictException(
        `This category still has ${count} product(s); move them to another category first`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
  }

  private async find(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }
}
```

- [ ] **Step 4: Run the spec to see it pass**

Run: `cd backend && npx jest src/categories`
Expected: PASS (5 tests).

- [ ] **Step 5: Controller, module, wiring**

`backend/src/categories/categories.controller.ts`:
```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import { CategoryDto } from './dto/category.dto';

@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Post()
  create(@Body() dto: CategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.remove(id);
  }
}
```

`backend/src/categories/categories.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [AuthModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
```

In `backend/src/app.module.ts` add `import { CategoriesModule } from './categories/categories.module';` and `CategoriesModule,` to `imports`.

- [ ] **Step 6: Build, test, smoke**

Run: `cd backend && npm run build && npm test` → all pass.
`curl -s localhost:3000/categories -H "Authorization: Bearer $TOKEN"` → `[{"name":"Finished Goods","productCount":1,...},{"name":"Raw Materials","productCount":1,...}]`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/categories backend/src/app.module.ts
git commit -m "feat(categories): category CRUD with product counts and safe delete"
git pull --rebase && git push
```

---

### Task 5: Frontend data layer + Products list page

**Files:**
- Modify: `frontend/package.json` (dependency)
- Create: `frontend/src/components/ui/SelectField.tsx`, `frontend/src/components/ui/Pager.tsx`; Modify: `frontend/src/components/ui/index.ts`
- Create: `frontend/src/lib/useDebouncedValue.ts`
- Create: `frontend/src/features/stock/types.ts`, `api.ts`, `hooks.ts`, `format.ts`, `StatusBadge.tsx`
- Create: `frontend/src/features/products/types.ts`, `api.ts`, `hooks.ts`, `ProductsPage.tsx`
- Modify: `frontend/src/router.tsx`

**Interfaces:**
- Consumes: `GET /products`, `GET /categories`, `GET /stock*` (Tasks 2–4).
- Produces (used by Tasks 6–9):
  - types `StockStatus`, `StockRow`, `Paginated<T>`, `StockFilters`, `LocationStock`, `LocationOption`, `StockKpis`; `Category`, `ReorderRule`, `ProductDetail`, `ProductInput`, `UOMS`, `Uom`
  - `stockKeys`, `useStockList(f)`, `useStockAlerts()`, `useStockKpis()`, `useProductLocations(id)`, `useLocations()`
  - `productKeys`, `useProducts(f)`, `useProduct(id)`, `useCreateProduct()`, `useUpdateProduct(id)`, `useArchiveProduct()`, `useSetReorderRule(id)`, `useRemoveReorderRule(id)`, `useCategories()`, `useCreateCategory()`, `useUpdateCategory()`, `useDeleteCategory()`
  - `formatQty(n)`, `formatMoney(n)`, `<StatusBadge status>`, `<SelectField>`, `<Pager>`, `useDebouncedValue(value, ms)`

- [ ] **Step 1: Install the Zod resolver**

Run: `npm install @hookform/resolvers@^3.9.0 -w frontend`

- [ ] **Step 2: Shared UI additions**

`frontend/src/components/ui/SelectField.tsx`:
```tsx
import { forwardRef, type SelectHTMLAttributes } from 'react';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  /** Renders a first option with value "" (e.g. "All categories"). */
  placeholder?: string;
}

// Native select styled like FormField. Works bare (filters) or labelled (forms),
// and forwards its ref so react-hook-form can register it.
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField({ label, error, options, placeholder, ...rest }, ref) {
    const select = (
      <select
        ref={ref}
        {...rest}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
    if (!label) return select;
    return (
      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        {select}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </label>
    );
  },
);
```

`frontend/src/components/ui/Pager.tsx`:
```tsx
interface PagerProps {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}

// Previous / next pagination under list tables. Hidden when there is one page.
export function Pager({ page, totalPages, onPage }: PagerProps) {
  if (totalPages <= 1) return null;
  const button =
    'rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="mt-4 flex items-center justify-end gap-3 text-sm text-slate-600">
      <button type="button" className={button} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className={button}
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
```

Append to `frontend/src/components/ui/index.ts`:
```ts
export { SelectField } from './SelectField';
export type { SelectOption } from './SelectField';
export { Pager } from './Pager';
```

`frontend/src/lib/useDebouncedValue.ts`:
```ts
import { useEffect, useState } from 'react';

/** Returns `value` once it has stopped changing for `ms` milliseconds. */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
```

- [ ] **Step 3: Stock data layer**

`frontend/src/features/stock/types.ts`:
```ts
// Mirrors backend/src/inventory/stock-row.ts. `type` (not interface) so rows
// satisfy the shared Table's Record<string, unknown> constraint.
export type StockStatus = 'OK' | 'LOW' | 'OUT';

export type StockRow = {
  id: string;
  name: string;
  sku: string;
  uom: string;
  unitCost: number;
  categoryId: string | null;
  categoryName: string | null;
  onHand: number;
  reserved: number;
  freeToUse: number;
  minQty: number | null;
  maxQty: number | null;
  status: StockStatus;
};

export type Paginated<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type StockFilters = {
  search?: string;
  categoryId?: string;
  status?: StockStatus;
  page?: number;
  pageSize?: number;
};

export type LocationStock = {
  locationId: string;
  locationName: string;
  warehouseName: string;
  qty: number;
};

export type LocationOption = {
  id: string;
  name: string;
  type: string;
  warehouseName: string;
};

export type StockKpis = {
  totalProductsInStock: number;
  lowStock: number;
  outOfStock: number;
  stockValue: number;
};
```

`frontend/src/features/stock/api.ts`:
```ts
import { api } from '@/lib/api';
import type {
  LocationOption,
  LocationStock,
  Paginated,
  StockFilters,
  StockKpis,
  StockRow,
} from './types';

export const stockApi = {
  list: (f: StockFilters) =>
    api.get<Paginated<StockRow>>('/stock', { params: f }).then((r) => r.data),
  alerts: () => api.get<StockRow[]>('/stock/alerts').then((r) => r.data),
  kpis: () => api.get<StockKpis>('/stock/kpis').then((r) => r.data),
  locations: () => api.get<LocationOption[]>('/stock/locations').then((r) => r.data),
  productLocations: (productId: string) =>
    api.get<LocationStock[]>(`/stock/${productId}/locations`).then((r) => r.data),
};
```

`frontend/src/features/stock/hooks.ts`:
```ts
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { stockApi } from './api';
import type { StockFilters } from './types';

export const stockKeys = {
  all: ['stock'] as const,
  list: (f: StockFilters) => ['stock', 'list', f] as const,
  alerts: ['stock', 'alerts'] as const,
  kpis: ['stock', 'kpis'] as const,
  locations: ['stock', 'locations'] as const,
  productLocations: (id: string) => ['stock', 'product-locations', id] as const,
};

export const useStockList = (f: StockFilters) =>
  useQuery({
    queryKey: stockKeys.list(f),
    queryFn: () => stockApi.list(f),
    placeholderData: keepPreviousData,
  });

export const useStockAlerts = () =>
  useQuery({ queryKey: stockKeys.alerts, queryFn: stockApi.alerts });

/** Dashboard stock KPIs — Role 2 renders these on the Dashboard. */
export const useStockKpis = () =>
  useQuery({ queryKey: stockKeys.kpis, queryFn: stockApi.kpis });

export const useLocations = () =>
  useQuery({ queryKey: stockKeys.locations, queryFn: stockApi.locations, staleTime: 60_000 });

export const useProductLocations = (id: string | undefined) =>
  useQuery({
    queryKey: stockKeys.productLocations(id ?? ''),
    queryFn: () => stockApi.productLocations(id as string),
    enabled: Boolean(id),
  });
```

`frontend/src/features/stock/format.ts`:
```ts
export const formatQty = (n: number) =>
  n.toLocaleString('en-IN', { maximumFractionDigits: 3 });

export const formatMoney = (n: number) =>
  n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
```

`frontend/src/features/stock/StatusBadge.tsx`:
```tsx
import type { StockStatus } from './types';

const styles: Record<StockStatus, string> = {
  OK: 'bg-emerald-50 text-emerald-700',
  LOW: 'bg-amber-50 text-amber-700',
  OUT: 'bg-red-50 text-red-700',
};

const labels: Record<StockStatus, string> = {
  OK: 'In stock',
  LOW: 'Low stock',
  OUT: 'Out of stock',
};

export const STATUS_OPTIONS = (['OK', 'LOW', 'OUT'] as StockStatus[]).map((s) => ({
  value: s,
  label: labels[s],
}));

export function StatusBadge({ status }: { status: StockStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
```

- [ ] **Step 4: Products data layer**

`frontend/src/features/products/types.ts`:
```ts
import type { LocationStock } from '@/features/stock/types';

// Mirrors backend UOMS in backend/src/products/dto/product.dto.ts.
export const UOMS = ['unit', 'kg', 'g', 'l', 'ml', 'm', 'box'] as const;
export type Uom = (typeof UOMS)[number];

/** Exact message the API returns for a duplicate SKU (products.service.ts). */
export const SKU_TAKEN = 'SKU already exists';

export type Category = { id: string; name: string; productCount: number };

export type ReorderRule = { minQty: number; maxQty: number | null };

export type ProductDetail = {
  id: string;
  name: string;
  sku: string;
  uom: string;
  unitCost: number;
  isActive: boolean;
  category: { id: string; name: string } | null;
  reorderRule: ReorderRule | null;
  locations: LocationStock[];
  createdAt: string;
  updatedAt: string;
};

export type ProductInput = {
  name: string;
  sku: string;
  categoryId: string | null;
  uom: string;
  unitCost: number;
  initialStock?: { qty: number; locationId?: string };
};
```

`frontend/src/features/products/api.ts`:
```ts
import { api } from '@/lib/api';
import type { Paginated, StockFilters, StockRow } from '@/features/stock/types';
import type { Category, ProductDetail, ProductInput, ReorderRule } from './types';

export const productsApi = {
  list: (f: StockFilters) =>
    api.get<Paginated<StockRow>>('/products', { params: f }).then((r) => r.data),
  get: (id: string) => api.get<ProductDetail>(`/products/${id}`).then((r) => r.data),
  create: (body: ProductInput) =>
    api.post<ProductDetail>('/products', body).then((r) => r.data),
  update: (id: string, body: Omit<ProductInput, 'initialStock'>) =>
    api.patch<ProductDetail>(`/products/${id}`, body).then((r) => r.data),
  archive: (id: string) => api.delete(`/products/${id}`).then(() => undefined),
  setReorderRule: (id: string, rule: ReorderRule) =>
    api.put<ReorderRule>(`/products/${id}/reorder-rule`, rule).then((r) => r.data),
  removeReorderRule: (id: string) =>
    api.delete(`/products/${id}/reorder-rule`).then(() => undefined),
};

export const categoriesApi = {
  list: () => api.get<Category[]>('/categories').then((r) => r.data),
  create: (name: string) => api.post('/categories', { name }).then((r) => r.data),
  update: (id: string, name: string) =>
    api.patch(`/categories/${id}`, { name }).then((r) => r.data),
  remove: (id: string) => api.delete(`/categories/${id}`).then(() => undefined),
};
```

`frontend/src/features/products/hooks.ts`:
```ts
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { stockKeys } from '@/features/stock/hooks';
import type { StockFilters } from '@/features/stock/types';
import { categoriesApi, productsApi } from './api';
import type { ProductInput, ReorderRule } from './types';

export const productKeys = {
  all: ['products'] as const,
  list: (f: StockFilters) => ['products', 'list', f] as const,
  detail: (id: string) => ['products', 'detail', id] as const,
  categories: ['categories'] as const,
};

// Product changes affect every stock view, so refresh both families.
const refreshStock = (qc: QueryClient) => {
  qc.invalidateQueries({ queryKey: productKeys.all });
  qc.invalidateQueries({ queryKey: stockKeys.all });
};

export const useProducts = (f: StockFilters) =>
  useQuery({
    queryKey: productKeys.list(f),
    queryFn: () => productsApi.list(f),
    placeholderData: keepPreviousData,
  });

export const useProduct = (id: string | undefined) =>
  useQuery({
    queryKey: productKeys.detail(id ?? ''),
    queryFn: () => productsApi.get(id as string),
    enabled: Boolean(id),
  });

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductInput) => productsApi.create(body),
    onSuccess: () => {
      refreshStock(qc);
      qc.invalidateQueries({ queryKey: productKeys.categories });
    },
  });
};

export const useUpdateProduct = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<ProductInput, 'initialStock'>) => productsApi.update(id, body),
    onSuccess: () => {
      refreshStock(qc);
      qc.invalidateQueries({ queryKey: productKeys.categories });
    },
  });
};

export const useArchiveProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productsApi.archive(id),
    onSuccess: () => refreshStock(qc),
  });
};

export const useSetReorderRule = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rule: ReorderRule) => productsApi.setReorderRule(id, rule),
    onSuccess: () => refreshStock(qc),
  });
};

export const useRemoveReorderRule = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => productsApi.removeReorderRule(id),
    onSuccess: () => refreshStock(qc),
  });
};

export const useCategories = () =>
  useQuery({ queryKey: productKeys.categories, queryFn: categoriesApi.list });

const useCategoryMutation = <A,>(fn: (args: A) => Promise<unknown>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.categories });
      refreshStock(qc);
    },
  });
};

export const useCreateCategory = () => useCategoryMutation((name: string) => categoriesApi.create(name));
export const useUpdateCategory = () =>
  useCategoryMutation(({ id, name }: { id: string; name: string }) => categoriesApi.update(id, name));
export const useDeleteCategory = () => useCategoryMutation((id: string) => categoriesApi.remove(id));
```
(`hooks.ts` contains no JSX, so the generic `<A,>` parses fine; if lint complains write `<A>`.)

- [ ] **Step 5: Products list page**

`frontend/src/features/products/ProductsPage.tsx`:
```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilterBar, Pager, SelectField, Table, type Column } from '@/components/ui';
import { formatQty } from '@/features/stock/format';
import { STATUS_OPTIONS, StatusBadge } from '@/features/stock/StatusBadge';
import type { StockRow, StockStatus } from '@/features/stock/types';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useCategories, useProducts } from './hooks';

const PAGE_SIZE = 20;

export function ProductList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<StockStatus | ''>('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const products = useProducts({
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    status: status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const categories = useCategories();

  const columns: Column<StockRow>[] = [
    { key: 'sku', header: 'SKU', render: (r) => <span className="font-mono text-xs">{r.sku}</span> },
    {
      key: 'name',
      header: 'Product',
      render: (r) => (
        <button
          type="button"
          className="font-medium text-brand-700 hover:underline"
          onClick={() => navigate(`/products/${r.id}`)}
        >
          {r.name}
        </button>
      ),
    },
    { key: 'categoryName', header: 'Category', render: (r) => r.categoryName ?? '—' },
    { key: 'onHand', header: 'On hand', render: (r) => `${formatQty(r.onHand)} ${r.uom}` },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <FilterBar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
      >
        <div className="w-48">
          <SelectField
            aria-label="Category"
            placeholder="All categories"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
        <div className="w-44">
          <SelectField
            aria-label="Stock status"
            placeholder="Any status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StockStatus | '');
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
        </div>
      </FilterBar>

      {products.error ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{products.error.message}</p>
      ) : (
        <Table
          columns={columns}
          rows={products.data?.data ?? []}
          empty={products.isLoading ? 'Loading…' : 'No products match these filters'}
        />
      )}
      <Pager page={page} totalPages={products.data?.totalPages ?? 1} onPage={setPage} />
    </div>
  );
}

export function ProductsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Products</h1>
        <Link
          to="/products/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          New product
        </Link>
      </div>
      <ProductList />
    </div>
  );
}
```

- [ ] **Step 6: Route it**

In `frontend/src/router.tsx`: remove `Products,` from the `./pages/placeholders` import, add `import { ProductsPage } from './features/products/ProductsPage';`, and change the products route to `{ path: 'products', element: <ProductsPage /> },`.
In `frontend/src/pages/placeholders.tsx` delete the `Products` placeholder export (and its comment).

- [ ] **Step 7: Type-check and check in the browser**

Run: `npm run build -w frontend`
Expected: `✓ built in …` with no TypeScript errors.
Manual (API + `npm run dev:web`, logged in as admin): `/products` lists Steel Rods, Office Chair, Desk; typing `desk` narrows to Desk; status "Out of stock" shows the unstocked seed products; category filter narrows; unauthenticated API errors show the red message box.

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json package-lock.json frontend/src/components/ui frontend/src/lib/useDebouncedValue.ts frontend/src/features frontend/src/router.tsx frontend/src/pages/placeholders.tsx
git commit -m "feat(products): products list with search, category and stock-status filters"
git pull --rebase && git push
```
Tell Role 2: `SelectField` and `Pager` were added to `components/ui` (exported from `index.ts`).

---

### Task 6: Product create/edit page (form, reorder rule, stock per location)

**Files:**
- Modify: `frontend/src/components/ui/FormField.tsx` (forwardRef)
- Create: `frontend/src/features/products/schemas.ts`, `frontend/src/features/products/ProductFormPage.tsx`
- Modify: `frontend/src/router.tsx`

**Interfaces:**
- Consumes: Task 5 hooks/types; `useLocations()`.
- Produces: routes `/products/new`, `/products/:id`; `productSchema`, `reorderRuleSchema`, `toProductInput(values, isNew)`.

- [ ] **Step 1: Make `FormField` registrable**

Replace `frontend/src/components/ui/FormField.tsx` with:
```tsx
import { forwardRef, type InputHTMLAttributes } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

// Label + input + inline error. Pairs with react-hook-form + zod so client-side
// validation shows the same graceful messages the API returns. Forwards its ref
// so `register()` can read and prefill the input.
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, error, ...inputProps },
  ref,
) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <input
        ref={ref}
        {...inputProps}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
});
```

- [ ] **Step 2: Zod schemas**

`frontend/src/features/products/schemas.ts`:
```ts
import { z } from 'zod';
import { UOMS, type ProductInput } from './types';

// Mirrors backend DTO rules so users see the same messages before submitting.
const maxDecimals = (places: number) => (n: number) =>
  Math.abs(n * 10 ** places - Math.round(n * 10 ** places)) < 1e-6;

const blankToUndefined = (v: unknown) =>
  v === '' || v === null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v;

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name must be at most 120 characters'),
  sku: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/, 'SKU must be 1-32 letters, digits, dot, dash or underscore'),
  categoryId: z.string(),
  uom: z.enum(UOMS),
  unitCost: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .min(0, 'Unit cost cannot be negative')
    .refine(maxDecimals(2), 'At most 2 decimals'),
  initialQty: z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ invalid_type_error: 'Enter a number' })
      .min(0, 'Quantity cannot be negative')
      .refine(maxDecimals(3), 'At most 3 decimals')
      .optional(),
  ),
  initialLocationId: z.string(),
});
export type ProductFormValues = z.infer<typeof productSchema>;

export function toProductInput(v: ProductFormValues, isNew: boolean): ProductInput {
  const input: ProductInput = {
    name: v.name,
    sku: v.sku,
    categoryId: v.categoryId || null,
    uom: v.uom,
    unitCost: v.unitCost,
  };
  if (isNew && v.initialQty && v.initialQty > 0) {
    input.initialStock = {
      qty: v.initialQty,
      ...(v.initialLocationId ? { locationId: v.initialLocationId } : {}),
    };
  }
  return input;
}

export const reorderRuleSchema = z
  .object({
    minQty: z.coerce
      .number({ invalid_type_error: 'Enter a number' })
      .min(0, 'Minimum cannot be negative')
      .refine(maxDecimals(3), 'At most 3 decimals'),
    maxQty: z.preprocess(
      blankToUndefined,
      z.coerce
        .number({ invalid_type_error: 'Enter a number' })
        .min(0, 'Maximum cannot be negative')
        .refine(maxDecimals(3), 'At most 3 decimals')
        .optional(),
    ),
  })
  .refine((v) => v.maxQty === undefined || v.maxQty >= v.minQty, {
    message: 'Maximum must be at least the minimum',
    path: ['maxQty'],
  });
export type ReorderRuleValues = z.infer<typeof reorderRuleSchema>;
```

- [ ] **Step 3: The page**

`frontend/src/features/products/ProductFormPage.tsx`:
```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FormField, SelectField, Table, type Column } from '@/components/ui';
import { formatQty } from '@/features/stock/format';
import { useLocations } from '@/features/stock/hooks';
import type { LocationStock } from '@/features/stock/types';
import {
  useArchiveProduct,
  useCategories,
  useCreateProduct,
  useProduct,
  useRemoveReorderRule,
  useSetReorderRule,
  useUpdateProduct,
} from './hooks';
import {
  productSchema,
  reorderRuleSchema,
  toProductInput,
  type ProductFormValues,
  type ReorderRuleValues,
} from './schemas';
import { SKU_TAKEN, UOMS, type ProductDetail, type ReorderRule, type Uom } from './types';

const primary =
  'rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50';
const secondary =
  'rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50';
const card = 'rounded-xl border border-slate-200 bg-white p-6';

export function ProductFormPage() {
  const { id } = useParams();
  const product = useProduct(id);

  if (id && product.isLoading) return <p className="text-slate-400">Loading…</p>;
  if (id && product.error)
    return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{product.error.message}</p>;

  const detail = product.data;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/products" className="text-sm text-slate-500 hover:underline">
          Products
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-2xl font-semibold text-slate-800">{detail ? detail.name : 'New product'}</h1>
      </div>
      <ProductForm key={detail?.id ?? 'new'} product={detail} />
      {detail && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ReorderRuleCard productId={detail.id} rule={detail.reorderRule} />
          <LocationsCard locations={detail.locations} uom={detail.uom} />
        </div>
      )}
    </div>
  );
}

function ProductForm({ product }: { product?: ProductDetail }) {
  const navigate = useNavigate();
  const categories = useCategories();
  const locations = useLocations();
  const create = useCreateProduct();
  const update = useUpdateProduct(product?.id ?? '');
  const archive = useArchiveProduct();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      categoryId: product?.category?.id ?? '',
      uom: (product?.uom as Uom) ?? 'unit',
      unitCost: product?.unitCost ?? 0,
      initialQty: undefined,
      initialLocationId: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSaved(false);
    try {
      if (product) {
        await update.mutateAsync(toProductInput(values, false));
        setSaved(true);
      } else {
        const created = await create.mutateAsync(toProductInput(values, true));
        navigate(`/products/${created.id}`, { replace: true });
      }
    } catch (e) {
      const message = (e as Error).message;
      if (message === SKU_TAKEN) setError('sku', { message });
      else setFormError(message);
    }
  });

  const onArchive = async () => {
    if (!product) return;
    try {
      await archive.mutateAsync(product.id);
      navigate('/products', { replace: true });
    } catch (e) {
      setFormError((e as Error).message);
    }
  };

  return (
    <form onSubmit={onSubmit} className={`${card} space-y-4`} noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Name" {...register('name')} error={errors.name?.message} />
        <FormField label="SKU / Code" {...register('sku')} error={errors.sku?.message} />
        <SelectField
          label="Category"
          placeholder="No category"
          options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          {...register('categoryId')}
          error={errors.categoryId?.message}
        />
        <SelectField
          label="Unit of measure"
          options={UOMS.map((u) => ({ value: u, label: u }))}
          {...register('uom')}
          error={errors.uom?.message}
        />
        <FormField
          label="Per unit cost (₹)"
          type="number"
          step="0.01"
          min="0"
          {...register('unitCost')}
          error={errors.unitCost?.message}
        />
      </div>

      {!product && (
        <fieldset className="grid gap-4 rounded-lg bg-slate-50 p-4 md:grid-cols-2">
          <legend className="px-1 text-sm font-medium text-slate-600">Initial stock (optional)</legend>
          <FormField
            label="Quantity on hand"
            type="number"
            step="0.001"
            min="0"
            {...register('initialQty')}
            error={errors.initialQty?.message}
          />
          <SelectField
            label="Location"
            placeholder="Main stock location (default)"
            options={(locations.data ?? []).map((l) => ({
              value: l.id,
              label: `${l.warehouseName} / ${l.name}`,
            }))}
            {...register('initialLocationId')}
          />
        </fieldset>
      )}

      {formError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
      {saved && <p className="text-sm text-emerald-700">Saved.</p>}

      <div className="flex items-center justify-between">
        <button type="submit" className={primary} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : product ? 'Save changes' : 'Create product'}
        </button>
        {product &&
          (confirmArchive ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">Hide this product from lists? Its history is kept.</span>
              <button type="button" className="rounded-lg bg-red-600 px-3 py-2 font-medium text-white" onClick={onArchive}>
                Archive
              </button>
              <button type="button" className={secondary} onClick={() => setConfirmArchive(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className={secondary} onClick={() => setConfirmArchive(true)}>
              Archive product
            </button>
          ))}
      </div>
    </form>
  );
}

function ReorderRuleCard({ productId, rule }: { productId: string; rule: ReorderRule | null }) {
  const setRule = useSetReorderRule(productId);
  const removeRule = useRemoveReorderRule(productId);
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReorderRuleValues>({
    resolver: zodResolver(reorderRuleSchema),
    defaultValues: { minQty: rule?.minQty ?? 0, maxQty: rule?.maxQty ?? undefined },
  });

  const onSubmit = handleSubmit(async (v) => {
    setMessage(null);
    try {
      await setRule.mutateAsync({ minQty: v.minQty, maxQty: v.maxQty ?? null });
      setMessage('Reorder rule saved.');
    } catch (e) {
      setMessage((e as Error).message);
    }
  });

  const onRemove = async () => {
    await removeRule.mutateAsync();
    reset({ minQty: 0, maxQty: undefined });
    setMessage('Reorder rule removed.');
  };

  return (
    <form onSubmit={onSubmit} className={`${card} space-y-4`} noValidate>
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Reorder rule</h2>
        <p className="text-sm text-slate-500">Flag this product as low stock at or below the minimum.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Minimum" type="number" step="0.001" min="0" {...register('minQty')} error={errors.minQty?.message} />
        <FormField label="Maximum (optional)" type="number" step="0.001" min="0" {...register('maxQty')} error={errors.maxQty?.message} />
      </div>
      {message && <p className="text-sm text-slate-600">{message}</p>}
      <div className="flex gap-2">
        <button type="submit" className={primary} disabled={isSubmitting}>
          Save rule
        </button>
        {rule && (
          <button type="button" className={secondary} onClick={onRemove}>
            Remove rule
          </button>
        )}
      </div>
    </form>
  );
}

function LocationsCard({ locations, uom }: { locations: LocationStock[]; uom: string }) {
  const columns: Column<LocationStock>[] = [
    { key: 'warehouseName', header: 'Warehouse' },
    { key: 'locationName', header: 'Location' },
    { key: 'qty', header: 'On hand', render: (l) => `${formatQty(l.qty)} ${uom}` },
  ];
  return (
    <div className={`${card} space-y-4`}>
      <h2 className="text-lg font-semibold text-slate-800">Stock per location</h2>
      <Table columns={columns} rows={locations} empty="No stock recorded yet" />
    </div>
  );
}
```

- [ ] **Step 4: Routes**

In `frontend/src/router.tsx` add `import { ProductFormPage } from './features/products/ProductFormPage';` and, after the `products` route:
```tsx
      { path: 'products/new', element: <ProductFormPage /> },
      { path: 'products/:id', element: <ProductFormPage /> },
```

- [ ] **Step 5: Type-check and check in the browser**

Run: `npm run build -w frontend` → no errors.
Manual:
1. `/products/new`, submit empty → "Name is required", SKU message; no request sent.
2. Name `Table`, SKU ` table-01 `, unit cost `3000`, initial qty `50` → lands on `/products/<id>` titled Table; SKU shows `TABLE-01`; Stock per location shows Main Store 50.
3. New product with SKU `table-01` → the SKU field shows "SKU already exists".
4. Reorder rule min `60`, max `10` → "Maximum must be at least the minimum"; min `60` max empty → "Reorder rule saved."; `/products` now shows Table as **Low stock**.
5. Edit name → "Saved."; Login page still works (FormField change).
6. Archive → confirm → back on `/products`, Table gone.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/FormField.tsx frontend/src/features/products frontend/src/router.tsx
git commit -m "feat(products): create/edit product with initial stock, reorder rule and per-location stock"
git pull --rebase && git push
```
Tell Role 2: `FormField` now forwards its ref (needed for react-hook-form); its props are unchanged.

---

### Task 7: Categories panel (Products page tab)

**Files:**
- Create: `frontend/src/features/products/CategoriesPanel.tsx`
- Modify: `frontend/src/features/products/ProductsPage.tsx` (tabs)

**Interfaces:**
- Consumes: `useCategories`, `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory` (Task 5).

- [ ] **Step 1: The panel**

`frontend/src/features/products/CategoriesPanel.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { Table, type Column } from '@/components/ui';
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from './hooks';
import type { Category } from './types';

const input =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';
const link = 'text-sm font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline';

export function CategoriesPanel() {
  const categories = useCategories();
  const create = useCreateCategory();
  const rename = useUpdateCategory();
  const remove = useDeleteCategory();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Category name is required');
    if (await run(() => create.mutateAsync(name.trim()))) setName('');
  };

  const onRename = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return setError('Category name is required');
    if (await run(() => rename.mutateAsync({ id: editing.id, name: editing.name.trim() }))) setEditing(null);
  };

  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'Category',
      render: (c) =>
        editing?.id === c.id ? (
          <input
            autoFocus
            aria-label="Category name"
            className={input}
            value={editing.name}
            onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRename();
              if (e.key === 'Escape') setEditing(null);
            }}
          />
        ) : (
          c.name
        ),
    },
    { key: 'productCount', header: 'Products' },
    {
      key: 'actions',
      header: '',
      render: (c) =>
        editing?.id === c.id ? (
          <span className="flex gap-3">
            <button type="button" className={link} onClick={onRename}>Save</button>
            <button type="button" className={link} onClick={() => setEditing(null)}>Cancel</button>
          </span>
        ) : (
          <span className="flex gap-3">
            <button type="button" className={link} onClick={() => setEditing({ id: c.id, name: c.name })}>
              Rename
            </button>
            <button
              type="button"
              className={link}
              disabled={c.productCount > 0}
              title={c.productCount > 0 ? 'Move its products to another category first' : undefined}
              onClick={() => run(() => remove.mutateAsync(c.id))}
            >
              Delete
            </button>
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <form onSubmit={onAdd} className="flex gap-2" noValidate>
        <input
          aria-label="New category name"
          placeholder="New category name"
          className={`${input} w-64`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add category
        </button>
      </form>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Table
        columns={columns}
        rows={categories.data ?? []}
        empty={categories.isLoading ? 'Loading…' : 'No categories yet'}
      />
    </div>
  );
}
```

- [ ] **Step 2: Tabs on the Products page**

Replace the `ProductsPage` function in `frontend/src/features/products/ProductsPage.tsx` with:
```tsx
export function ProductsPage() {
  const [tab, setTab] = useState<'products' | 'categories'>('products');
  const tabClass = (active: boolean) =>
    `-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
      active ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
    }`;
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Products</h1>
        {tab === 'products' && (
          <Link
            to="/products/new"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            New product
          </Link>
        )}
      </div>
      <div className="mb-4 flex border-b border-slate-200">
        <button type="button" className={tabClass(tab === 'products')} onClick={() => setTab('products')}>
          Products
        </button>
        <button type="button" className={tabClass(tab === 'categories')} onClick={() => setTab('categories')}>
          Categories
        </button>
      </div>
      {tab === 'products' ? <ProductList /> : <CategoriesPanel />}
    </div>
  );
}
```
and add `import { CategoriesPanel } from './CategoriesPanel';` at the top.

- [ ] **Step 3: Type-check and check in the browser**

Run: `npm run build -w frontend` → no errors.
Manual: Categories tab lists both seed categories with counts; Add "Tools" → appears with 0; Add "Tools" again → "A category with this name already exists"; Add blank → "Category name is required"; Rename Tools → "Hand Tools" with Enter; Delete is disabled on categories with products and works on Hand Tools; the category filter on the Products tab now offers the new names.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/products/CategoriesPanel.tsx frontend/src/features/products/ProductsPage.tsx
git commit -m "feat(products): manage categories from the Products page"
git pull --rebase && git push
```

---

### Task 8: Stock page, low-stock banner, dashboard KPI card, nav item

**Files:**
- Create: `frontend/src/features/stock/StockPage.tsx`, `frontend/src/features/stock/LowStockCard.tsx`
- Modify: `frontend/src/router.tsx`, `frontend/src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `useStockList`, `useStockAlerts`, `useStockKpis`, `useCategories` (Task 5).
- Produces: route `/stock` (reads `?status=OK|LOW|OUT`); `<StockKpiCards />` (in `LowStockCard.tsx`) + `useStockKpis()` for Role 2's Dashboard. `StockPage` accepts an `onUpdate?: (row: StockRow) => void` hook-in used by Task 9.

- [ ] **Step 1: Stock page**

`frontend/src/features/stock/StockPage.tsx`:
```tsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterBar, Pager, SelectField, Table, type Column } from '@/components/ui';
import { useCategories } from '@/features/products/hooks';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { formatMoney, formatQty } from './format';
import { useStockAlerts, useStockList } from './hooks';
import { STATUS_OPTIONS, StatusBadge } from './StatusBadge';
import type { StockRow, StockStatus } from './types';

const PAGE_SIZE = 20;
const isStatus = (v: string | null): v is StockStatus => v === 'OK' || v === 'LOW' || v === 'OUT';

export function StockPage({ onUpdate }: { onUpdate?: (row: StockRow) => void }) {
  const [params, setParams] = useSearchParams();
  const statusParam = params.get('status');
  const status: StockStatus | '' = isStatus(statusParam) ? statusParam : '';
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const stock = useStockList({
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    status: status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const alerts = useStockAlerts();
  const categories = useCategories();

  const setStatus = (next: StockStatus | '') => {
    setPage(1);
    setParams(next ? { status: next } : {});
  };

  const out = alerts.data?.filter((r) => r.status === 'OUT').length ?? 0;
  const low = alerts.data?.filter((r) => r.status === 'LOW').length ?? 0;

  const columns: Column<StockRow>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.name}</p>
          <p className="font-mono text-xs text-slate-400">{r.sku}</p>
        </div>
      ),
    },
    { key: 'unitCost', header: 'Per unit cost', render: (r) => formatMoney(r.unitCost) },
    { key: 'onHand', header: 'On hand', render: (r) => `${formatQty(r.onHand)} ${r.uom}` },
    {
      key: 'freeToUse',
      header: 'Free to use',
      render: (r) => (
        <span
          className={r.freeToUse < 0 ? 'font-medium text-red-600' : undefined}
          title={r.reserved > 0 ? `${formatQty(r.reserved)} ${r.uom} reserved by pending deliveries` : undefined}
        >
          {formatQty(r.freeToUse)} {r.uom}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    ...(onUpdate
      ? [
          {
            key: 'actions',
            header: '',
            render: (r: StockRow) => (
              <button
                type="button"
                className="text-sm font-medium text-brand-700 hover:underline"
                onClick={() => onUpdate(r)}
              >
                Update stock
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Stock</h1>

      {out + low > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>
            <strong>{out + low}</strong> product{out + low === 1 ? '' : 's'} need attention: {out} out of stock,{' '}
            {low} low.
          </span>
          <span className="flex gap-3">
            {out > 0 && (
              <button type="button" className="font-medium underline" onClick={() => setStatus('OUT')}>
                Show out of stock
              </button>
            )}
            {low > 0 && (
              <button type="button" className="font-medium underline" onClick={() => setStatus('LOW')}>
                Show low stock
              </button>
            )}
          </span>
        </div>
      )}

      <FilterBar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
      >
        <div className="w-48">
          <SelectField
            aria-label="Category"
            placeholder="All categories"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
        <div className="w-44">
          <SelectField
            aria-label="Stock status"
            placeholder="Any status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StockStatus | '')}
            options={STATUS_OPTIONS}
          />
        </div>
      </FilterBar>

      {stock.error ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{stock.error.message}</p>
      ) : (
        <Table
          columns={columns}
          rows={stock.data?.data ?? []}
          empty={stock.isLoading ? 'Loading…' : 'No products match these filters'}
        />
      )}
      <Pager page={page} totalPages={stock.data?.totalPages ?? 1} onPage={setPage} />
    </div>
  );
}
```

- [ ] **Step 2: Dashboard card for Role 2**

`frontend/src/features/stock/LowStockCard.tsx`:
```tsx
import { Link } from 'react-router-dom';
import { KpiCard } from '@/components/ui';
import { formatQty } from './format';
import { useStockKpis } from './hooks';

/** Role 3's two dashboard tiles. Role 2 drops these into the Dashboard grid. */
export function StockKpiCards() {
  const { data } = useStockKpis();
  return (
    <>
      <Link to="/stock" className="block">
        <KpiCard label="Total in Stock" value={data ? formatQty(data.totalProductsInStock) : '—'} />
      </Link>
      <Link to={data && data.outOfStock > 0 ? '/stock?status=OUT' : '/stock?status=LOW'} className="block">
        <KpiCard
          label="Low / Out of Stock"
          value={data ? `${data.lowStock} / ${data.outOfStock}` : '—'}
          accent={data && data.outOfStock > 0 ? 'danger' : 'warning'}
        />
      </Link>
    </>
  );
}
```

- [ ] **Step 3: Route + nav**

In `frontend/src/router.tsx` add `import { StockPage } from './features/stock/StockPage';` and `{ path: 'stock', element: <StockPage /> },` after the products routes.
In `frontend/src/components/layout/Sidebar.tsx` add `Boxes` to the `lucide-react` import and insert into `links` after Products:
```ts
  { to: '/stock', label: 'Stock', icon: Boxes },
```

- [ ] **Step 4: Type-check and check in the browser**

Run: `npm run build -w frontend` → no errors.
Manual: sidebar shows **Stock**; `/stock` shows cost/on-hand/free-to-use/status; the amber banner counts match the rows; "Show low stock" sets `?status=LOW` and filters; the status select round-trips the URL; opening `/stock?status=OUT` directly pre-filters.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/stock frontend/src/router.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(stock): stock page with free-to-use, low-stock banner and dashboard KPI cards"
git pull --rebase && git push
```
Tell Role 2: replace the first two Dashboard placeholder tiles with `<StockKpiCards />` from `@/features/stock/LowStockCard`; `useStockKpis()` is available for anything else.

---

### Task 9: "Update stock" modal (gated on Role 4)

**Gate:** Before starting, get Role 4 to confirm their quick-adjustment endpoint. Code below assumes `POST /adjustments/quick` with body `{ locationId, productId, countedQty }` that creates and validates an adjustment in one call (posting `countedQty − recorded` to the ledger). If their path/body differs, change only `adjustStock` in `features/stock/api.ts`. **If it is not available by 14:00, skip this task** — the Stock page already renders without the action column.

**Files:**
- Modify: `frontend/src/features/stock/api.ts`, `frontend/src/features/stock/hooks.ts`
- Create: `frontend/src/features/stock/UpdateStockModal.tsx`
- Modify: `frontend/src/router.tsx` (wrap `StockPage` with the modal)

**Interfaces:**
- Consumes: `useLocations`, `useProductLocations` (Task 5); Role 4's endpoint.
- Produces: `stockApi.adjustStock(body)`, `useAdjustStock()`, `<StockPageWithAdjust />`.

- [ ] **Step 1: API + mutation**

Add to `stockApi` in `frontend/src/features/stock/api.ts`:
```ts
  /** Role 4's quick adjustment: counts one product at one location. */
  adjustStock: (body: { locationId: string; productId: string; countedQty: number }) =>
    api.post('/adjustments/quick', body).then((r) => r.data),
```
Add to `frontend/src/features/stock/hooks.ts` (and import `useMutation`, `useQueryClient` from `@tanstack/react-query`):
```ts
export const useAdjustStock = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: stockApi.adjustStock,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stockKeys.all });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
};
```

- [ ] **Step 2: The modal**

`frontend/src/features/stock/UpdateStockModal.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { FormField, Modal, SelectField } from '@/components/ui';
import { formatQty } from './format';
import { useAdjustStock, useLocations, useProductLocations } from './hooks';
import { StockPage } from './StockPage';
import type { StockRow } from './types';

const hasAtMost3Decimals = (n: number) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6;

export function UpdateStockModal({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const locations = useLocations();
  const current = useProductLocations(row.id);
  const adjust = useAdjustStock();
  const [locationId, setLocationId] = useState('');
  const [counted, setCounted] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recorded = current.data?.find((l) => l.locationId === locationId)?.qty ?? 0;
  const countedQty = Number(counted);
  const valid = counted !== '' && Number.isFinite(countedQty) && countedQty >= 0 && hasAtMost3Decimals(countedQty);
  const diff = valid ? countedQty - recorded : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!locationId) return setError('Pick a location');
    if (!valid) return setError('Enter a counted quantity of 0 or more, with at most 3 decimals');
    setError(null);
    try {
      await adjust.mutateAsync({ locationId, productId: row.id, countedQty });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal open title={`Update stock — ${row.name}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <SelectField
          label="Location"
          placeholder="Choose a location"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          options={(locations.data ?? []).map((l) => {
            const qty = current.data?.find((c) => c.locationId === l.id)?.qty ?? 0;
            return { value: l.id, label: `${l.warehouseName} / ${l.name} (${formatQty(qty)} ${row.uom})` };
          })}
        />
        <FormField
          label={`Counted quantity (${row.uom})`}
          type="number"
          step="0.001"
          min="0"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
        />
        {locationId && diff !== null && (
          <p className="text-sm text-slate-600">
            Recorded {formatQty(recorded)} → counted {formatQty(countedQty)}:{' '}
            <strong className={diff < 0 ? 'text-red-600' : diff > 0 ? 'text-emerald-700' : undefined}>
              {diff > 0 ? '+' : ''}
              {formatQty(diff)} {row.uom}
            </strong>{' '}
            will be logged as an adjustment.
          </p>
        )}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={adjust.isPending || diff === 0}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {adjust.isPending ? 'Saving…' : 'Apply adjustment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** The Stock page with the "Update stock" row action enabled. */
export function StockPageWithAdjust() {
  const [row, setRow] = useState<StockRow | null>(null);
  return (
    <>
      <StockPage onUpdate={setRow} />
      {row && <UpdateStockModal row={row} onClose={() => setRow(null)} />}
    </>
  );
}
```

- [ ] **Step 3: Use it on the route**

In `frontend/src/router.tsx` replace the `StockPage` import with `import { StockPageWithAdjust } from './features/stock/UpdateStockModal';` and the route element with `<StockPageWithAdjust />`.

- [ ] **Step 4: Type-check and verify end-to-end**

Run: `npm run build -w frontend` → no errors.
Manual: on `/stock`, Update stock on Table → pick Main Store (shows 50) → counted `47` → preview "−3 unit will be logged as an adjustment" → Apply → modal closes, on-hand shows 47; Move History (Role 4) lists the adjustment; counted `-1` or `1.2345` → validation message, no request.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/stock frontend/src/router.tsx
git commit -m "feat(stock): update stock from the Stock page via an inventory adjustment"
git pull --rebase && git push
```
