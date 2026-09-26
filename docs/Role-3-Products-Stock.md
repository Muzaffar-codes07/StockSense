# Role 3 — Products & Stock Engineer

> You own the **master data** (what products exist) and the **"what's on hand"** views + alerts. Build Products first — Role 4 can't receive stock until products exist. You feed the stock KPIs into Role 2's dashboard.

See [README](./README.md) for the shared model, schema, and contracts.

---

## Scope

### 1. Product Management
- Create / update products with: **Name, SKU / Code, Category, Unit of Measure, Initial stock (optional).**
- Initial stock (if provided) → post an opening move via Role 1's `postMove()` (don't write stock directly).
- **Product Categories** — CRUD, assign to products.
- **Reordering rules** — min/max qty per product (optionally per location).

### 2. Stock availability
- **Stock availability per location** — read via Role 1's `stock_on_hand()`, grouped by product & location.
- Product list shows current on-hand.

### 3. Alerts & search
- **Low-stock / out-of-stock alerts** — flag products at/under reorder min.
- **SKU search & smart filters** — on product lists, using Role 2's filter bar; filter by **product category**.

### 4. Stock KPI endpoints (for the Dashboard)
Expose the numbers Role 2's dashboard displays: **Total Products in Stock**, **Low Stock / Out-of-Stock Items**.

---

## You provide → others consume
- Product + category lists → Role 4's operation line-items (receipts/deliveries/transfers/adjustments).
- Stock KPI endpoints → Role 2's dashboard.

## You consume from others
- **Role 1:** `stock_on_hand()`, auth, warehouse/location list.
- **Role 2:** filter bar, table, form, modal components — build your screens with these.

---

## Suggested order
1. **Products CRUD first** (unblocks Role 4) → categories → reorder rules.
2. Stock-per-location views (against Role 1's on-hand read).
3. Low-stock alerts + SKU search/filters.
4. Stock KPI endpoints → hand to Role 2 for the dashboard.

## Definition of done
- [ ] Create/update products with all fields; SKU unique.
- [ ] Categories CRUD and assignable; reorder rules saved per product.
- [ ] Stock availability shown per location, matching the ledger.
- [ ] Low/out-of-stock correctly flagged.
- [ ] SKU search + category filter functional.
- [ ] Stock KPI endpoints return correct counts.

## Judged on
Logic (reorder/alerts) · database/query performance · modularity · usability of product management.
