# Role 2 — Frontend Platform & Dashboard Engineer

> You own the app's look, feel, and cohesion — the shell every screen plugs into, the shared component library the feature teams build with, and the **Dashboard** (the first thing reviewers see). A dedicated UI owner is how we win "clean UI / usability / front-end design" — several scored criteria at once.

See [README](./README.md) for the shared model, schema, and contracts.

---

## Scope

### 1. Frontend foundation
- Frontend scaffold, routing, environment config.
- **App layout + left sidebar navigation** (Products, Operations, Move History, Dashboard, Settings).
- **Profile menu:** My Profile, Logout.

### 2. Design system + shared components
Consumed by R1 (settings), R3, R4 — build these early so nobody is blocked:
- **Data table, modal, form field, dynamic filter bar, toast/validation display.**
- Consistent color scheme, spacing, typography (pull structure from the Excalidraw mockup).

### 3. Dashboard + KPIs
Landing page snapshot of inventory operations. KPIs:
- **Total Products in Stock** *(from Role 3)*
- **Low Stock / Out-of-Stock Items** *(from Role 3)*
- **Pending Receipts** *(from Role 4)*
- **Pending Deliveries** *(from Role 4)*
- **Internal Transfers Scheduled** *(from Role 4)*

### 4. Dynamic filters (shared)
The filter bar used across the app — by **document type** (Receipts / Delivery / Internal / Adjustments), **status** (Draft/Waiting/Ready/Done/Canceled), **warehouse/location**, and **product category**. You build the component; R3/R4 wire their data into it.

---

## You provide → others consume
- UI shell + shared components + filter bar → R1 (settings screen), R3, R4.
- Consistent design tokens → the whole app.

## You consume from others
- **Role 1:** auth (login state), warehouse/location list for filters.
- **Role 3:** stock KPI endpoints (Total in Stock, Low/Out-of-Stock).
- **Role 4:** operation count endpoints (Pending Receipts/Deliveries/Transfers).
- Stub KPI values with mock data until R3/R4 endpoints land — don't block on them.

---

## Suggested order
1. Frontend scaffold + routing + **static shell** (sidebar, profile) — no backend needed, do first.
2. Component library + filter bar (unblocks R3/R4 screens).
3. Dashboard layout with mock KPIs.
4. Wire real KPIs from R3/R4 at integration.

## Definition of done
- [ ] Sidebar navigates to every section; profile menu logs out.
- [ ] Component library (table/modal/form/filter/toast) reusable and documented.
- [ ] Dashboard shows all 5 KPIs with real numbers; filters apply across lists.
- [ ] Consistent styling across every screen (no visual drift between teammates' pages).

## Judged on
Front-end design · usability · intuitive navigation · UI consistency — plus modularity of the component library.
