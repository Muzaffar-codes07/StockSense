import type { ReactNode } from 'react';

// Shared placeholder card so the shell is navigable from day one.
// Each role replaces the matching page with real screens.
function Placeholder({ title, owner, children }: { title: string; owner: string; children?: ReactNode }) {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-800">{title}</h1>
      <p className="mb-6 text-sm text-slate-400">Owned by {owner}</p>
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
        {children ?? 'Build me 👷'}
      </div>
    </div>
  );
}

// Role 2 — replace with KPI cards + charts, wiring counts from Roles 3 & 4.
export const Dashboard = () => (
  <Placeholder title="Dashboard" owner="Role 2 — Frontend Platform">
    KPIs: Total in Stock · Low/Out of Stock · Pending Receipts · Pending Deliveries · Transfers Scheduled
  </Placeholder>
);

// Role 3 — products CRUD, categories, reorder rules, stock per location.
export const Products = () => (
  <Placeholder title="Products" owner="Role 3 — Products & Stock" />
);

// Role 4 — receipts, deliveries, transfers, adjustments (tabs).
export const Operations = () => (
  <Placeholder title="Operations" owner="Role 4 — Warehouse Operations" />
);

// Role 4 — ledger view of every movement.
export const MoveHistory = () => (
  <Placeholder title="Move History" owner="Role 4 — Warehouse Operations" />
);

// Role 1 — warehouse & location settings.
export const Settings = () => (
  <Placeholder title="Settings" owner="Role 1 — Backend Core (Warehouses)" />
);

// Role 1 — current user profile.
export const Profile = () => (
  <Placeholder title="My Profile" owner="Role 1 — Backend Core (Auth)" />
);
