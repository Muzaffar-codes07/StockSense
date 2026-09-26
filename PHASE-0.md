# Phase 0 — Sign-off Checklist

Phase 0 = the shared foundation every role builds on. It is **done** when the six
contracts below are locked *and* the two human gates at the bottom are signed off.
Don't start feature work on `main` until both gates are checked.

> Status legend: ✅ done & verified · ⚠️ needs a human · ⬜ not started

---

## The six contracts

| # | Contract | Where it lives | Status |
|---|----------|----------------|--------|
| 1 | **DB schema** — every entity, frozen as a committed migration | `backend/prisma/schema.prisma`, `backend/prisma/migrations/` | ✅ validates, 22 FKs, migration committed |
| 2 | **Stock Ledger** — `postMove()` + derived `stockOnHand()` / `totalStock()` | `backend/src/stock/stock.service.ts` | ✅ implemented + 7 unit tests passing |
| 3 | **Doc status enum** — `Draft → Waiting → Ready → Done → Canceled` | `schema.prisma` (`DocStatus`) | ✅ |
| 4 | **API + validation + list/filter convention** | `main.ts` (ValidationPipe), `common/http-exception.filter.ts`, `common/pagination.dto.ts` | ✅ |
| 5 | **Auth token + protected-route convention** | `auth/` (JWT), `auth/jwt-auth.guard.ts`, `common/current-user.decorator.ts` | ✅ signup/login work; OTP reset stubbed for Role 1 |
| 6 | **UI shell + shared components** | `frontend/src/components/layout/`, `frontend/src/components/ui/` | ✅ shell + Table/Modal/FormField/FilterBar/KpiCard |

---

## Verified so far (automated)

- [x] `npx prisma validate` passes
- [x] `npx prisma generate` succeeds
- [x] Init migration committed (`backend/prisma/migrations/*_init/`)
- [x] Backend builds — `cd backend && npm run build` → `dist/main.js`
- [x] Frontend builds — `cd frontend && npm run build`
- [x] Ledger tests pass — `cd backend && npm test` (7/7)
- [x] API boots and `GET /health` returns 200 (graceful `db:false` when DB is down)

---

## ⚠️ Gate A — Live database run (needs a machine with Docker or local Postgres)

Nobody has run the schema against a real database yet. Do this once — full
step-by-step in **[docs/GATE-A-RUNBOOK.md](./docs/GATE-A-RUNBOOK.md)**:

```bash
cp .env.example .env
docker compose up -d db
cd backend && cp .env.example .env && npm install
npx prisma migrate deploy      # applies the committed migration
npm run prisma:seed            # demo data + admin@stocksense.dev / password123
npm run start:dev
# open http://localhost:3000/health  ->  { "status": "ok", "db": true }
```

- [x] `migrate deploy` applies cleanly (18 tables + the `stock_quant` view)
- [x] `prisma:seed` runs without error (admin user, 1 warehouse, 2 locations, 2 products)
- [x] `GET /health` shows `"db": true`
- [x] View works: `SELECT * FROM stock_quant` returns without error
- [x] Live integration test green: `npm run test:db` → 8/8, demo flow nets **77**, per-location split 67/10, KPIs/alerts/free-to-use correct
- [x] Auth against real DB: login, `/auth/me`, OTP request (returns `devOtp`) all OK
- [x] Signed off by: **Role 1 — validated 2026-09-26 via a user-space Postgres 17.11 (mise) run.**
      Engineering risk closed (migration + view + ledger flow proven on real Postgres). The
      team may still re-run in their own Docker env, but it is no longer a blocker.
      Note: this run surfaced and fixed a main-breaking missing dep (`@nestjs/mapped-types`, commit 380b9ef).

### Manual DB objects (not in schema.prisma)

- **`stock_quant` view** — derived on-hand qty per (product, location); the single-query source for all stock screens and dashboard numbers. Read-only via `$queryRaw`; `postMove()` stays the sole writer. Prisma does not model views, so **any future migration that alters the `StockMove` columns it reads must DROP and re-CREATE it** (noted in the migration file).

## ⚠️ Gate B — Team schema review (~15 min, all members)

Database design is the #1-scored criterion — it must be a *team* decision, not one person's.
Everyone reads `backend/prisma/schema.prisma` and agrees on:

- [ ] Entity coverage matches the problem statement (products, receipts, deliveries, transfers, adjustments, ledger)
- [ ] The ledger model (derived stock, no stored on-hand) is understood by all
- [ ] `Decimal(18,3)` quantities and `Location` relations accepted
- [ ] `Product.unitCost` (stock-value KPI) and `Product.isActive` (archive-not-delete) accepted
- [ ] `stock_quant` view is the agreed read path for stock screens/KPIs (via `$queryRaw`)
- [ ] Naming conventions agreed (so all roles are consistent)
- [ ] Reviewed by: __________ / __________ / __________ / __________

---

## Once both gates are checked

Phase 0 is closed. Fan out onto `main` (single-branch, everyone commits — keep commits
small and pull often). Ownership map is in [`docs/README.md`](./docs/README.md):

- **Role 1** — auth/OTP, warehouses, ledger hardening
- **Role 2** — dashboard, design system, shared components
- **Role 3** — products, stock views, alerts
- **Role 4** — receipts, deliveries, transfers, adjustments, move history
