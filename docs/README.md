# StockSense (IMS) — Team Handoff

A modular **Inventory Management System** for the Odoo hiring hackathon. Goal: replace manual registers, Excel sheets, and scattered tracking with a centralized, real-time app.

**Team of 4 — two platform roles + two feature roles.** Feature roles own their domain end-to-end (DB → API → UI); everything pivots on one shared mechanism: the **Stock Ledger**.

- [Role 1 — Backend Core & Data](./Role-1-Backend-Core-Data.md)
- [Role 2 — Frontend Platform & Dashboard](./Role-2-Frontend-Platform-Dashboard.md)
- [Role 3 — Products & Stock](./Role-3-Products-Stock.md)
- [Role 4 — Warehouse Operations](./Role-4-Warehouse-Operations.md)

**Mockup:** https://link.excalidraw.com/l/65VNwvy7c4X/3ENvQFu9o8R — pull layout/nav from here in Phase 0.

---

## Core mental model — the Stock Ledger

Everything in this app is one idea: **every stock change is a "move" written to a ledger, and current stock is *derived* by summing moves.** No document ever edits a stock number directly.

| Operation | What it posts to the ledger |
|---|---|
| Receipt (incoming) | move **into** a location → stock **+** |
| Delivery (outgoing) | move **out of** a location → stock **−** |
| Internal Transfer | move from location A **→** B (total unchanged) |
| Adjustment | move to reconcile counted vs recorded (**±**) |

`stock_on_hand(product, location) = Σ(moves in) − Σ(moves out)`

Build this engine first (Role 1). Everyone else just creates documents that call it.

---

## Phase 0 — Freeze together before splitting (~first 2–3 hrs, all 4)

Locking these 6 contracts is what lets everyone work without blocking. It's also where the **database-design** score is won (judged the single most important criterion).

1. **DB schema** (see proposed schema below) — Role 1 stewards migrations after.
2. **Stock Ledger** — the `stock_move` shape + a single `postMove()` service.
3. **Stock-on-hand read** — one endpoint/query everyone uses; nobody recomputes.
4. **Doc status enum** — `Draft → Waiting → Ready → Done → Canceled`.
5. **API + validation conventions** — route naming, response envelope, error/validation format, filter & pagination query params.
6. **Auth token + UI shell** — token format (R1); routing, left sidebar, shared components (R2).

---

## Proposed schema (starting point for Phase 0)

```
users(id, name, email UNIQUE, password_hash, created_at)
password_reset_otp(id, user_id → users, otp_code, expires_at, used)

warehouses(id, name, address)
locations(id, warehouse_id → warehouses, name, type[stock|production|rack|...], parent_id → locations NULL)

categories(id, name)
products(id, name, sku UNIQUE, category_id → categories, uom, created_at)
reorder_rules(id, product_id → products, location_id → locations NULL, min_qty, max_qty)

partners(id, name, type[supplier|customer])   -- receipt suppliers & delivery customers

-- THE LEDGER (single source of truth for stock)
stock_moves(id, product_id → products,
            from_location_id → locations NULL,
            to_location_id   → locations NULL,
            qty, move_type[receipt|delivery|internal|adjustment],
            doc_type, doc_id, done_at, created_at)

-- Operation documents (header + lines); "validate" generates stock_moves
receipts(id, partner_id → partners, status, created_at, validated_at)
receipt_lines(id, receipt_id → receipts, product_id → products, qty)

deliveries(id, partner_id → partners, status, created_at, validated_at)
delivery_lines(id, delivery_id → deliveries, product_id → products, qty)

transfers(id, from_location_id → locations, to_location_id → locations, status, created_at, validated_at)
transfer_lines(id, transfer_id → transfers, product_id → products, qty)

adjustments(id, location_id → locations, status, created_at, validated_at)
adjustment_lines(id, adjustment_id → adjustments, product_id → products, counted_qty, recorded_qty, diff)
```

`stock_on_hand` can be a SQL **VIEW** over `stock_moves` (or a cached table refreshed on validate).

---

## Ownership at a glance

| Area | Owner |
|---|---|
| Backend scaffold, DB migrations, auth + OTP, **ledger engine**, warehouse/location model + settings | **Role 1** |
| Frontend scaffold, routing, sidebar nav + profile menu, **design system + shared components**, **Dashboard + KPIs + filters** | **Role 2** |
| Products, categories, reorder rules, stock-per-location, low-stock alerts, SKU search & filters | **Role 3** |
| Receipts, deliveries, internal transfers, adjustments, move history, doc state machine | **Role 4** |

## Dependency map (all seams frozen in Phase 0)

```
Role 1 ─ ledger postMove() + on-hand read + auth + warehouse API ─▶ used by everyone
Role 2 ─ UI shell + shared components ─▶ used by R1(settings), R3, R4
Role 4 ─ posts moves ─▶ Ledger ;  ops counts ─▶ Role 2 Dashboard
Role 3 ─ reads on-hand ─▶ stock views/alerts ;  stock KPIs ─▶ Role 2 Dashboard ;  products ─▶ Role 4 line items
```

Two platform roles (1 & 2) unblock the two feature roles (3 & 4). R3/R4 stay full-stack for their domains, using R1's APIs and R2's components.

---

## Build sequence (no idle waiting)

1. **All:** Phase 0 contracts.
2. **Parallel unblockers:** R1 ships backend skeleton (auth + ledger stub + DB); R2 ships frontend skeleton (shell + routing + component library).
3. **Parallel features:** R3 builds **Products first** (R4 needs products to receive); R4 builds **Receipts first** (creates the stock everything else consumes).
4. **Dashboard:** R2 wires KPIs — stock counts from R3, operation counts from R4.
5. **Integrate + demo:** run the spec's end-to-end flow as the demo script:
   - Receive 100 kg steel (**+100**) → Transfer Main Store → Production Rack (total unchanged) → Deliver 20 (**−20**) → Adjust 3 kg damaged (**−3**) → verify Stock Ledger.
6. **Polish:** validation edge cases, UI consistency, seed data, rehearse — **everyone presents their own slice** (shared ownership is scored).

## Git workflow (explicitly scored)

- Branch per role: `feat/backend-core`, `feat/frontend-platform`, `feat/products`, `feat/operations`.
- PRs into `main`; **every member commits** — "version control is a team sport."
- Small, frequent, reviewed PRs.

## Hackathon requirements (apply to everyone)

- Local relational DB (**MySQL / PostgreSQL**) — **no** Firebase / Supabase / MongoDB Atlas.
- Custom backend APIs, built from scratch; minimal third-party APIs.
- Real-time / dynamic data (no static JSON in the final build).
- **Robust input validation** with graceful, user-facing error messages.
- Clean, consistent, interactive UI; intuitive navigation.
- Understand every tool/library you use — no blind copy-paste.
