# Role 3 — Products & Stock: Design

- Date: 2026-09-26
- Owner: Role 3 (Products & Stock)
- Status: Approved
- Depends on: Phase 0 schema + `StockService.postMove()` (Role 1), shared UI components (Role 2)

## Goal

Give the team the master data (products, categories, reorder rules) and every "what's on hand"
view: stock per product, stock per location, low/out-of-stock alerts and the stock KPIs on the
dashboard. Role 4 must be able to pick products on receipt lines as early as possible, and every
number shown must match the ledger exactly.

## Data

Role 3 never writes stock numbers. Stock is derived from `StockMove`; Role 3 only reads it.

Schema additions (requested in the Gate B review, folded into the init migration by Role 1):

| Change | Why |
|---|---|
| `Product.unitCost Decimal(12,2) default 0` | "Per unit cost" column on the Stock page; stock-value KPI |
| `Product.isActive Boolean default true` | Archive instead of delete — moves reference products |
| `StockMove @@index([productId, toLocationId])`, `@@index([productId, fromLocationId])` | Serve the grouped view below |
| `stock_quant` SQL view (raw SQL in the migration) | One set-based source of on-hand per product and location |

```sql
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

The view is read with typed `$queryRaw` (Prisma's `views` preview feature is not used).
`ReorderRule` stays one rule per product (no per-location rules).

## Business rules

- **SKU** — trimmed and upper-cased before save; unique. Duplicate → `409 "SKU already exists"`.
- **Initial stock** — optional `{ qty, locationId }` on create. Posted through
  `postMove({ moveType: ADJUSTMENT, toLocationId, docType: 'initial', createdById })` inside the
  same transaction as the product insert. Missing `locationId` → first `STOCK`-type location.
- **Stock status** — `OUT` if on-hand ≤ 0; `LOW` if a reorder rule exists and on-hand ≤ `minQty`;
  otherwise `OK`.
- **Free to use** — on-hand − Σ `DeliveryLine.qty` where the delivery status is `WAITING` or
  `READY` (statuses to be confirmed by Role 4). Product-level only: deliveries carry no source
  location. A negative value is shown and flagged.
- **Reorder rule** — `minQty ≥ 0`, `maxQty` optional and ≥ `minQty`.
- **Delete** — products are archived (`isActive = false`) and hidden from pickers; a category with
  products cannot be deleted (`409`).

## Backend (NestJS)

All routes use `JwtAuthGuard`, `PaginationQueryDto` for lists and the shared error envelope.

| Module | Endpoints |
|---|---|
| `categories/` | `GET /categories`, `POST`, `PATCH /:id`, `DELETE /:id` |
| `products/` | `GET /products?search&categoryId&stockStatus&page&pageSize`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` (archive) |
| | `PUT /products/:id/reorder-rule`, `DELETE /products/:id/reorder-rule` |
| `inventory/` (read-only) | `GET /stock?search&categoryId&status`, `GET /stock/:productId/locations`, `GET /stock/alerts`, `GET /stock/kpis` |

`GET /stock/kpis` → `{ totalProductsInStock, lowStock, outOfStock, stockValue }`, where
`totalProductsInStock` counts active products with on-hand > 0 and `stockValue` = Σ on-hand × unitCost.

## Frontend (React)

Built only from Role 2's `Table`, `Modal`, `FormField`, `FilterBar`, `KpiCard`.

| Route | Content |
|---|---|
| `/products` | Table: SKU, name, category, UoM, on-hand, status badge. Filters: search, category, stock status. Categories tab. |
| `/products/new`, `/products/:id` | Product form, reorder-rule card, stock-per-location table. Initial stock fields on create only. |
| `/stock` | Mockup Stock page: product, per-unit cost, on-hand, free to use, status. Low/out banner. Row action **Update stock** → modal (location + counted qty) → Role 4's adjustment endpoint. |

- Forms: React Hook Form + Zod mirroring the backend DTOs; server errors mapped onto fields.
- Data: TanStack Query keys `['products', filters]`, `['stock', filters]`, `['categories']`;
  mutations invalidate them. A future `stock.moved` WebSocket event only needs to invalidate `['stock']`.
- Layout: `frontend/src/features/products/`, `frontend/src/features/stock/`
  (each with `api.ts`, `hooks.ts`, pages); backend `src/products`, `src/categories`, `src/inventory`.

## Interfaces with other roles

| Direction | What |
|---|---|
| Role 3 → Role 4 | `GET /products` (active only) for line-item pickers |
| Role 3 → Role 2 | `useStockKpis()` hook + "Low stock" KPI card linking to `/stock?status=low` |
| Role 1 → Role 3 | Schema additions above; `postMove()` with `createdById` |
| Role 4 → Role 3 | Adjustment endpoint `{ locationId, productId, countedQty }`; confirmation of reserving statuses |
| Role 2 → Role 3 | **Stock** item in the sidebar; toast component (inline errors until then) |

If Role 4's adjustment endpoint is not available by ~14:00, the **Update stock** action is hidden,
not faked.

## Testing

- Jest unit tests: SKU normalisation, the OK/LOW/OUT rule, the free-to-use calculation,
  reorder-rule validation.
- One integration test against the Docker Postgres running the brief's flow — receive 100 →
  transfer → deliver 20 → adjust −3 — asserting `stock_quant` totals exactly 77 and the per-location
  split is correct.

## Out of scope

Per-location reorder rules, automatic replenishment orders, product variants, product images,
stock valuation methods (FIFO/AVCO).
