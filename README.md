# StockSense — Inventory Management System (IMS)

A modular IMS that replaces manual registers, Excel sheets, and scattered tracking with a **centralized, real-time app**. Built for the Odoo hiring hackathon.

**Core idea:** every stock change is a *move* written to a ledger; current stock is **derived** by summing moves. Nothing stores a mutable quantity — the ledger is the single source of truth.

## Tech stack

| Layer | Choice |
|---|---|
| Database | **PostgreSQL 16** |
| Backend | **NestJS + TypeScript**, **Prisma** (ORM + migrations), class-validator, JWT + argon2 |
| Frontend | **React + Vite + TypeScript**, Tailwind CSS, TanStack Query, React Router, React Hook Form + Zod, Recharts |
| Dev | Docker Compose (`db + api + web`), ESLint + Prettier, one language (TS) end-to-end |

## Repository layout

```
backend/    NestJS backend — DB schema, ledger engine, auth (Role 1)
frontend/   React frontend — shell, design system, dashboard (Role 2)
docs/       Team handoff — README + one brief per role
```

## Quick start

### Option A — Docker (one command)
```bash
cp .env.example .env
docker compose up --build
# api  -> http://localhost:3000/health
# web  -> http://localhost:5173
```

### Option B — Local dev
```bash
# 1. Database
cp .env.example .env
docker compose up -d db

# 2. Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init   # applies the committed migration / creates tables
npm run prisma:seed                   # demo data + admin@stocksense.dev / password123
npm run start:dev                     # http://localhost:3000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                           # http://localhost:5173
```

## What's already wired (the foundation)

- **DB schema** — full StockSense model in `backend/prisma/schema.prisma` (users, warehouses/locations, products/categories, partners, the `StockMove` ledger, and receipt/delivery/transfer/adjustment documents).
- **Stock Ledger engine** — `backend/src/stock/stock.service.ts`: `postMove()`, `stockOnHand()`, `totalStock()`. **This is the contract Roles 3 & 4 build against.**
- **Auth** — sign-up + login working (JWT + argon2); OTP reset stubbed for Role 1 to finish.
- **Global validation + error envelope** — `ValidationPipe` + `HttpExceptionFilter` for graceful, consistent errors.
- **Frontend shell** — sidebar nav, routing, profile/logout, working login, TanStack Query + axios client. Placeholder page per section, tagged with its owning role.
- **Health check** — `GET /health` returns `{ status, db }` so you can confirm the whole stack is up.

## Team & branches

See [`docs/README.md`](./docs/README.md) for the full plan. Branch per role, PRs into `main`, everyone commits:

| Branch | Owner |
|---|---|
| `feat/backend-core` | Role 1 — DB, auth/OTP, ledger, warehouses |
| `feat/frontend-platform` | Role 2 — shell, design system, dashboard |
| `feat/products` | Role 3 — products, stock, alerts |
| `feat/operations` | Role 4 — receipts, deliveries, transfers, adjustments |

## Ground rules (hackathon brief)

- Local relational DB only — **no** Firebase / Supabase / MongoDB Atlas.
- Custom APIs from scratch; minimal third-party APIs; no static JSON in the final build.
- Robust input validation with graceful errors. Clean, consistent UI. Understand every tool you use.
