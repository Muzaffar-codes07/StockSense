# StockSense — Inventory Management System

A modular inventory app that replaces manual registers and spreadsheets with one
real-time system: products, stock per location, receipts, deliveries, transfers,
stock counts, and a full audit trail. Built for the Odoo hiring hackathon.

**Core idea:** every stock change is a *move* written to an append-only ledger.
Stock is never stored as an editable number — it is **derived** from the ledger:

```
on hand (product, location) = Σ moves into the location − Σ moves out of it
free to use                 = on hand − quantities on open (waiting/ready) deliveries
forecast                    = on hand + open receipts − open deliveries
```

## Features

| Area | What you can do |
|---|---|
| **Auth** | Sign up, log in, reset a forgotten password with a one-time code. JWT sessions, argon2-hashed passwords and codes, rate-limited auth endpoints, role-based access (Admin / Manager / Staff). |
| **Dashboard** | Live KPIs: products in stock, low / out of stock, pending receipts, pending deliveries, open transfers. The stock tiles open the filtered Stock list. |
| **Products & categories** | Create, edit, archive products (SKU validated and unique, case-insensitive). Optional initial stock is posted to the ledger. Reorder rules (min / max) per product. Categories with safe delete. |
| **Stock** | Every product with on hand, free to use, forecast and OK / LOW / OUT status; search and filters; low/out alert banner. Click *free to use* for the worked breakdown (per location, and each open delivery / receipt). *Update stock* records a physical count as an inventory adjustment. |
| **Operations** | Receipts, deliveries, internal transfers, inventory adjustments — draft → waiting → ready → done. *Validate* posts the moves to the ledger; stock can never go negative, and a document can never post twice (even when validated concurrently). |
| **Move history** | The immutable ledger: every move with product, quantity, from/to location, document and time, searchable and filterable. |

## Quick start

Prerequisites: **Node 20+**, **npm 10+**, **Docker** (for PostgreSQL).

### Option A — local dev (recommended)

```bash
npm install                                   # installs backend + frontend (npm workspaces)
cp .env.example .env
cp backend/.env.example backend/.env
docker compose up -d db                       # PostgreSQL 16 on localhost:5432
npm run db:demo                               # creates tables + loads demo data (resets the DB)
npm run dev:api                               # API  → http://localhost:3000   (health: /health)
npm run dev:web                               # new terminal · Web → http://localhost:5173
```

Log in with **admin@stocksense.dev / password123** (Admin).

> Port 5432 already taken by a local PostgreSQL? Map the container to another port
> (e.g. `"5433:5432"` in `docker-compose.yml`) and use that port in `DATABASE_URL`
> in `backend/.env`.

### Option B — everything in Docker

```bash
cp .env.example .env
docker compose up --build -d                  # db + api (runs migrations) + web
docker compose exec api npx prisma db seed    # admin user, warehouse, locations, categories
docker compose exec api npm run seed:demo     # a week of demo documents and stock
```

Web → http://localhost:5173 · API → http://localhost:3000. Run the two seed commands once.

### What the demo data contains

`npm run db:demo` loads a week of validated documents plus some open ones, created
through the app's own services (so every number comes from the ledger):

| Product | On hand | Open documents | Status |
|---|---|---|---|
| Steel Rods | 77 kg (Main Store 67 / Production Rack 10) | delivery waiting: 10 kg | OK |
| Office Chair | 40 | delivery ready: 8 | OK |
| Screws M6 | 12 (reorder at 20) | receipt ready: 100 | LOW |
| Wood Varnish 1L | 0 | receipt ready: 60 | OUT → forecast 60 |

## Roles and permissions

New sign-ups are **Staff**; the seeded admin is **Admin** (allowed everything).

| Action | Staff | Manager | Admin |
|---|:-:|:-:|:-:|
| View dashboard, products, stock, operations, history | ✅ | ✅ | ✅ |
| Transfers, inventory adjustments, *Update stock* | ✅ | ✅ | ✅ |
| Receipts and deliveries (create, edit, validate, cancel) | — | ✅ | ✅ |
| Create / edit / archive products, categories, reorder rules | — | ✅ | ✅ |
| Create / edit warehouses and locations | — | ✅ | ✅ |

Validated documents can't be canceled — correct them with an inventory adjustment.

## Tests

```bash
npm test -w backend          # unit tests (no database needed)
npm run test:db -w backend   # live-database tests: ledger, concurrency, HTTP end-to-end
npm test -w frontend         # component tests (Vitest + Testing Library)
```

`test:db` needs the database running with migrations applied (`npm run db:demo` does both).
It creates its own uniquely-named rows and removes them afterwards.

Highlights: the brief's demo flow totals exactly 77 (split 67 / 10); five concurrent
validations of one document post exactly once; overselling is rejected with nothing
posted; every protected route returns 401 without a valid token; Staff gets 403 on
product and category changes.

## Tech stack

| Layer | Choice |
|---|---|
| Database | **PostgreSQL 16** (local, in Docker) — `stock_quant` SQL view over the ledger |
| Backend | **NestJS 10 + TypeScript**, **Prisma 5** (schema + migrations), class-validator, JWT + argon2, @nestjs/throttler |
| Frontend | **React 18 + Vite + TypeScript**, Tailwind CSS, TanStack Query, React Router, React Hook Form + Zod |
| Tests | Jest + Supertest (backend, incl. live-DB), Vitest + Testing Library (frontend) |

## Repository layout

```
backend/
  prisma/            schema, migrations, seed.ts (base) + seed-demo.ts (demo data)
  src/stock/         the ledger: postMove(), stock guards (the only writer of stock)
  src/inventory/     stock views: list, KPIs, alerts, per-location, breakdown
  src/products/      products + reorder rules      src/categories/  categories
  src/operations/    receipts, deliveries, transfers, adjustments, move history
  src/auth/          sign up, login, OTP reset      src/warehouses/  warehouses, locations
frontend/src/
  pages/             dashboard, operations, move history, login
  features/          products/, stock/  (feature folders: api, hooks, pages, tests)
  components/        layout (shell, sidebar) and shared UI
docs/                demo script, audit, specs and plans
```

## Team

| Role | Area | Member |
|---|---|---|
| 1 | Backend core: database, ledger, auth, warehouses | Tuhin ([@Tuhin-void](https://github.com/Tuhin-void)) |
| 2 | Frontend platform, design system, dashboard | Nirmayi ([@3upho](https://github.com/3upho)) |
| 3 | Products, categories, stock (team lead) | Muzaffar ([@Muzaffar-codes07](https://github.com/Muzaffar-codes07)) |
| 4 | Warehouse operations and move history | Bhanu ([@vbtgongithub](https://github.com/vbtgongithub)) |

## Hackathon ground rules we follow

- Local relational database only (PostgreSQL in Docker) — no Firebase / Supabase / hosted DBs.
- All APIs written from scratch; no static or mock JSON in the app — every screen reads the API.
- Robust validation on both sides (class-validator DTOs, Zod forms) with clear, consistent error messages.
