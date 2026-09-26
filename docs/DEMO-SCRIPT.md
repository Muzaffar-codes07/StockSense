# StockSense — Demo Video Script

**Recording:** 16:15–16:50 IST · **Video link due:** 17:30 IST · **Target length:** ~6–7 min

Each role owns its section. Replace the *suggested* beats in your section with the
exact clicks and lines you'll say, and commit by **15:45**. Keep to your time box.

## Before recording (whoever drives the screen)

1. `git pull --rebase`, then `npm run db:demo` from the repo root (stop the API first).
   This resets the **local** DB and loads the demo data. Every number below assumes it.
2. Start the API (`npm run start:dev -w backend`) and web (`npm run dev -w frontend`).
3. Log in as **admin@stocksense.dev / password123** (ADMIN role; new sign-ups are STAFF).
4. Browser at 100% zoom, one tab, notifications off.

### What the demo data contains
| Product | On hand | Open documents | Status |
|---|---|---|---|
| Steel Rods | 77 kg (Main Store 67 / Production Rack 10) | DEL waiting: 10 kg · REC draft: 150 kg | OK |
| Office Chair | 40 | DEL ready: 8 · TRF draft: 5 to the rack | OK |
| Wooden Table | 12 | — | OK |
| Screws M6 | 12 (reorder min 20) | REC ready: 100 | **LOW** |
| Wood Varnish 1L | 0 | REC ready: 60 | **OUT** |
| Oak Plank | 0 (never stocked) | — | **OUT** |

Move History has 9 validated moves over the past 6 days: Steel's demo flow is
receive 100 → transfer 30 to the rack → deliver 20 → 3 kg damaged = **77**.

## Running order

| # | Section | Owner | Time |
|---|---|---|---|
| 1 | Sign up, login, forgot password | Role 2 (Nirmayi) + Role 1 (Tuhin) | 0:45 |
| 2 | Dashboard | Role 2 (Nirmayi) | 0:30 |
| 3 | Products & Stock | Role 3 (Muzaffar) | 2:00 |
| 4 | Operations & Move History | Role 4 (Bhanu) | 1:45 |
| 5 | Under the hood: ledger, safety, tests | Role 1 (Tuhin) | 1:00 |

Sections 3 and 4 hand over state: section 3 leaves Steel at **75 kg**, and section 4
validates the varnish receipt so Varnish flips from OUT to OK on screen.

---

## 1. Sign up, login, forgot password — Role 2 + Role 1 (0:45)
*Suggested beats. Owners: replace with your exact clicks.*
- Sign up a new user → lands on the Dashboard; the sidebar shows "Signed in as …".
- Log out → **Forgot password** → request a code (dev mode shows it on screen) → set a new password → log in.
- Line: "Passwords and reset codes are hashed, reset codes expire in 10 minutes, and login is rate-limited."
- Log back in as **admin** for the rest of the demo.

## 2. Dashboard — Role 2 (0:30)
*Suggested beats. Owner: replace with your exact clicks.*
- Tiles: Total in Stock, Low / Out of Stock, Pending Receipts (2), Pending Deliveries (2), Internal Transfers (1).
- Line: "Every tile is live from the API — nothing on this screen is hard-coded."
- Click **Low / Out of Stock** → lands on the Stock page filtered to out-of-stock (hand-off to section 3).

## 3. Products & Stock — Role 3 (2:00)

**1. Products (20s)**
- Products → **New product**: "Walnut Shelf", SKU `WALNUT-01`, unit, ₹35, initial stock 20 at Main Store.
- Before creating, show validation: clear the unit cost → *"Unit cost is required"*;
  type SKU `steel-001` → *"SKU already exists"* (SKUs are case-insensitive). Then create.
- Line: "Initial stock isn't typed into a field — it's posted to the stock ledger as a move, like everything else."

**2. Stock page (25s)**
- Open **Stock**. Banner: *"3 products need attention: 2 out of stock, 1 low"* → **Show low stock** → Screws.
- Clear the filter; point at On hand, Free to use, Forecast, Status.
- Line: "No stock number is stored. Every figure is calculated live from the ledger."

**3. Free-to-use breakdown (25s)**
- Click Steel's **67 kg** → 77 on hand (Main Store 67 / Production Rack 10) − 10 held by **DEL-…** for Beta Retailers = **67** free.
- Line: "Why 67 when there are 77? Ten are promised to Beta Retailers on this delivery."

**4. Forecast (15s)**
- Wood Varnish: **OUT**, forecast **60 l — "+60 incoming"**.
- Line: "Out of stock today, but a confirmed receipt brings 60, so we're covered. Drafts don't count until confirmed."

**5. Update stock (25s)**
- Steel → **Update stock** → Main Store, counted **65** → save. On hand 77 → **75**.
- Move History → new *ADJUSTMENT −2 kg*.
- Line: "A physical count becomes an inventory adjustment — every correction is on the record."

**6. Back to the Dashboard (10s)**
- *Low / Out of Stock* tile → click → Stock page filtered to out-of-stock.

## 4. Operations & Move History — Role 4 (1:45)
*Presented by Muzaffar (Bhanu unavailable). Rehearsed against the API: every number below checked.*

**1. Receipt → the forecast comes true (30s)**
- **Operations** → **Receipts (Incoming)** → the READY receipt from **Acme Steel Co.** (Varnish 60 + Screws 100) → **Validate** → location **Main Store** → **Confirm & Validate**.
- Jump to **Stock**: Wood Varnish **OUT → OK (60 l)**, Screws **LOW → OK (112)**.
- Line: "The forecast said we were covered — validating the receipt is what actually moves the stock."

**2. Delivery that can't be filled (35s)**
- **Operations** → **Deliveries** tab → **New Delivery** → Steel Rods, qty **500**.
  The line turns **red: "Only 65 kg free to use"** (75 on hand − 10 already promised).
- **Create Delivery Order** anyway → **Validate** → **Main Store** → **Confirm & Validate**.
- The modal shows *"Not enough stock for Steel Rods (STEEL-001): 65 available, 500 requested"*. Nothing posts.
- Line: "Warned before, refused at validate — stock can never go negative."

**3. Internal transfer (15s)**
- **Transfers** tab → the DRAFT transfer of 5 Office Chairs, Main Store → Production Rack → **Validate**.
- Line: "Transfers move stock between locations; the company total doesn't change."

**4. Move History (25s)**
- **Move History** → search **steel** → filter **Inventory Adjustment**: section 3's −2 kg count is there.
- Clear the filter: every receipt, delivery, transfer and adjustment, newest first, paged.
- Line: "Validating a document is the only way stock moves, it posts exactly once — even if two people click at the same moment — and every move is here forever."

## 5. Under the hood — Role 1 (1:00)
*Suggested beats. Owner: replace with your exact clicks.*
- The ledger: `StockMove` is append-only; on hand = moves in − moves out, via the `stock_quant` view.
- Safety: stock can't go negative (a per-location lock); a document can't post twice
  (atomic claim in `validate()`); DB CHECK constraints reject malformed moves (qty ≤ 0, no location).
- Terminal: `npm run test:db -w backend` → show *"5 concurrent validations: exactly one posts"* and the green totals.
- Ledger health: `GET /ledger/integrity` → `"ok": true` across 5 checks (view matches a fresh ledger sum,
  no negative stock, every validated document posted exactly once, no orphan moves, moves well-formed).
- Time machine: `GET /ledger/as-of?at=<4 days ago>` → Steel Rods **100 kg** (Main Store 70 / Production Rack 30),
  against **77 kg** today. It's the same ledger replayed up to a date.
- Security: JWT + role-based access, rate-limited auth, hashed reset codes, 401 on every protected route (tested).
- Close: "Every stock number traces back to a move in the ledger."
