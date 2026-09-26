# Gate A Runbook — first live-database run

The only Phase-0 step that needs a real Postgres. Run it **once** on any machine
with Docker (or a local Postgres). ~5 minutes. When the checks pass, tick the
Gate A boxes in [`PHASE-0.md`](../PHASE-0.md).

Why it matters: the schema, the hand-written `stock_quant` view, and every
endpoint are build- and unit-test-verified but have **never touched a real DB**.
This run proves the migration applies, the view works, and the ledger math is
correct end-to-end.

---

## Prerequisites
- Docker Desktop / Docker Engine running (`docker info` works without sudo), **or** a local Postgres 16.
- Node 20+.
- Repo cloned; you're on `main`.

---

## Option A — one command (Docker, easiest)

```bash
cp .env.example .env
docker compose up --build
```

This starts Postgres, builds the API (its Dockerfile runs `prisma migrate deploy`
on boot), and starts the web app. Then, in another terminal:

```bash
curl -s localhost:3000/health          # expect: {"status":"ok","db":true}
```

Seed the demo data (one-off):
```bash
docker compose exec api npm run prisma:seed
```

Web UI: http://localhost:5173 — log in with **admin@stocksense.dev / password123**.

---

## Option B — local dev (more control)

```bash
# 1) Database
cp .env.example .env
docker compose up -d db                 # or point DATABASE_URL at your local PG

# 2) Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy               # applies the init migration + stock_quant view
npm run prisma:seed                     # admin user, Main Warehouse, 2 locations, 2 products
npm run start:dev                       # API on http://localhost:3000

# 3) Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                             # http://localhost:5173
```

---

## Verification checks (this IS Gate A)

```bash
# 1. Health — DB connected
curl -s localhost:3000/health
#    -> {"status":"ok","db":true}

# 2. The stock_quant VIEW exists and answers
psql "$DATABASE_URL" -c "SELECT * FROM stock_quant LIMIT 5;"
#    (with docker: docker compose exec db psql -U stocksense -d stocksense -c "SELECT * FROM stock_quant LIMIT 5;")

# 3. Ledger integration test — the brief's flow nets to 77
cd backend
DATABASE_URL="postgresql://stocksense:stocksense@localhost:5432/stocksense?schema=public" npm run test:db
#    -> stock-quant.db-spec passes (receive 100 -> transfer -> deliver 20 -> adjust -3 = 77)

# 4. Auth smoke
curl -s -X POST localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@stocksense.dev","password":"password123"}'
#    -> {"accessToken":"..."}
```

Then in the browser: log in, confirm the sidebar renders and the dashboard loads.

---

## Troubleshooting
- **`permission denied ... docker.sock`** → your user isn't in the `docker` group; use `sudo`, or use Option B with a local Postgres.
- **Port 5432 in use** → another Postgres is running; stop it or change the port in `.env` + `docker-compose.yml`.
- **`migrate deploy` says "already applied"** → fine, the DB is current.
- **`relation "stock_quant" does not exist`** → the view is appended to the init migration SQL; make sure you ran `migrate deploy` (not just `db push`), and that the migration folder committed to `main` is present.
- **`/health` shows `db:false`** → the API can't reach Postgres; check `DATABASE_URL` host (`db` inside Docker, `localhost` when running the API on the host).

---

## Sign-off
When checks 1–4 pass, in `PHASE-0.md` → **Gate A**: tick the boxes and add your name.
Combined with Gate B (team schema review), Phase 0 is closed.
