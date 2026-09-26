# Role 4 — Warehouse Operations Engineer

> You own **every stock-moving document.** All four operations share one pattern — *create → add lines → validate → post to ledger* — so you build that pattern once and reuse it: faster and more consistent. Build **Receipts first**: it creates the stock that deliveries, transfers, and adjustments all depend on.

See [README](./README.md) for the shared model, schema, and contracts.

---

## The shared operation pattern
Every document follows the same lifecycle and status flow (`Draft → Waiting → Ready → Done → Canceled`). On **Validate**, generate `stock_moves` via Role 1's `postMove()` — never edit stock directly. Build this skeleton once, then specialize per operation.

## Scope

### 1. Receipts (Incoming Goods)
Items arriving from vendors.
1. Create a receipt → 2. Add **supplier & products** → 3. Input quantities received → 4. **Validate → stock increases** (`move_type=receipt`, into destination location).
- *Example: receive 50 units "Steel Rods" → stock +50.*

### 2. Delivery Orders (Outgoing Goods)
Stock leaving for customer shipment.
1. **Pick** items → 2. **Pack** items → 3. **Validate → stock decreases** (`move_type=delivery`, out of source location).
- *Example: sales order for 10 chairs → delivery reduces chairs by 10.*

### 3. Internal Transfers
Move stock inside the company; **total stock unchanged, location updated** (`move_type=internal`, from → to).
- *Examples: Main Warehouse → Production Floor; Rack A → Rack B; Warehouse 1 → Warehouse 2.*

### 4. Inventory Adjustments
Reconcile **recorded stock vs physical count**.
- Select product/location → enter counted qty → system computes diff, auto-updates, and logs it (`move_type=adjustment`, ±).

### 5. Move History + filters
- **Move History** view over the ledger (every movement logged).
- Dynamic filters on operation lists (doc type / status) using Role 2's filter bar.

### 6. Count endpoints (for the Dashboard)
Expose counts for Role 2's KPIs: **Pending Receipts, Pending Deliveries, Internal Transfers Scheduled.**

---

## You provide → others consume
- Ledger movements → power Role 3's stock-on-hand and alerts.
- Operation count endpoints → Role 2's dashboard.

## You consume from others
- **Role 1:** `postMove()` + doc status enum + auth + warehouse/location list. Code against the `postMove()` signature from Phase 0 before it's fully done.
- **Role 2:** filter bar, table, form, modal components.
- **Role 3:** product & category lists for document line-items (use seed/mock products until Products ships).

---

## Suggested order
1. Build the **shared document skeleton** (header + lines + status state machine + validate→postMove).
2. **Receipts** (creates stock) → **Deliveries** → **Internal Transfers** → **Adjustments**.
3. Move History view + list filters.
4. Count endpoints → hand to Role 2 for dashboard integration.

## Definition of done
- [ ] All four document types: create, add lines, validate; status transitions enforced.
- [ ] Validate posts correct moves: receipt **+**, delivery **−**, transfer relocates (total unchanged), adjustment **±**.
- [ ] Every movement appears in Move History / Stock Ledger.
- [ ] Doc-type & status filters work on operation lists.
- [ ] Count endpoints return Pending Receipts / Deliveries / Transfers.
- [ ] End-to-end demo flow passes: Receive 100 → Transfer → Deliver 20 → Adjust −3, ledger balances.

## Judged on
Logic & correctness (stock math must be exact) · modularity (one reused document pattern) · debugging skill · usability of the pick/pack/validate flows.
