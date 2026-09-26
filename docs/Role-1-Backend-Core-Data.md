# Role 1 — Backend Core & Data Engineer

> You own the backend backbone and the app's single most important mechanism — the **Stock Ledger** — plus its most-scored artifact, the **database schema**. Your work is front-loaded: ship a runnable backend skeleton fast so Roles 3 & 4 unblock.

See [README](./README.md) for the shared model, schema, and contracts.

---

## Scope

### 1. Backend foundation
- Backend scaffold, folder structure, environment config.
- **Database connection + migrations tooling.** You are the **schema steward** — after Phase 0, all schema changes go through you.
- Local DB: **MySQL or PostgreSQL** (no BaaS).
- Shared API conventions in code: response envelope, error/validation format, pagination + filter query-param parsing.

### 2. Authentication
- Sign up / log in.
- **OTP-based password reset** (generate OTP → store with expiry → verify → set new password).
- Session/JWT, protected routes, current-user context. On login → redirect to Dashboard.

### 3. Stock Ledger engine (the core contract)
- `stock_moves` table + a single **`postMove({product, from_location, to_location, qty, move_type, doc_type, doc_id})`** service.
- **`stock_on_hand(product, location)`** read (SQL view or cached table) — the one function everyone else reads.
- Others **never** touch stock numbers directly; they only call `postMove()`.

### 4. Warehouse & locations
- Warehouse + **Location** model (stock / production / rack, nestable), multi-warehouse.
- Warehouse/location API + the **Settings → Warehouse** screen (built with Role 2's components).

---

## You provide → others consume
- `postMove()` + `stock_on_hand()` → Role 4 (operations) and Role 3 (stock views/KPIs).
- Auth/session → protects every endpoint.
- Warehouse/location list → R3 & R4 selectors.

## You consume from others
- **Role 2:** shared UI components for your Settings screen (use their table/form/modal).

---

## Suggested order
1. Scaffold + DB connection + migrations → **backend skeleton with auth + ledger stub** (unblocks the team — first).
2. Real auth + OTP reset.
3. Stock Ledger engine + on-hand read — freeze the `postMove()` signature early so R4 can code against it.
4. Warehouse/location model + settings.

## Definition of done
- [ ] Migrations create the full Phase-0 schema from scratch.
- [ ] Sign up, log in, OTP password reset work; protected routes reject unauthenticated calls.
- [ ] `postMove()` writes a ledger row; `stock_on_hand()` returns correct derived qty.
- [ ] Warehouses + locations CRUD; multi-warehouse selectable.
- [ ] `postMove()` signature + on-hand endpoint documented so R3/R4 build without asking.

## Judged on
Database design (**most important**) · security (auth, OTP, protected routes) · modular architecture · coding standard · scalability of the ledger model.
