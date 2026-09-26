import { useQuery } from '@tanstack/react-query';
import { KpiCard } from '../components/ui/KpiCard';
import { StockKpiCards } from '../features/stock/LowStockCard';
import { getOperationsKpiCounts } from '../lib/operations';

export default function Dashboard() {
  // Live counts from Role 4's GET /operations/kpi-counts. No fallback numbers:
  // a tile shows "—" until real data arrives.
  const ops = useQuery({ queryKey: ['operations', 'kpi-counts'], queryFn: getOperationsKpiCounts });
  const count = (n: number | undefined) => n ?? '—';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Inventory Overview</h1>
        {ops.isLoading && <span className="text-sm text-gray-500">Syncing live metrics...</span>}
        {ops.isError && (
          <span className="text-sm text-red-600">Couldn't load operation counts. Is the API running?</span>
        )}
      </div>

      {/* 5 Scope-required KPIs for Role 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StockKpiCards />
        <KpiCard label="Pending Receipts" value={count(ops.data?.pendingReceipts)} />
        <KpiCard label="Pending Deliveries" value={count(ops.data?.pendingDeliveries)} />
        <KpiCard label="Internal Transfers" value={count(ops.data?.scheduledTransfers)} />
      </div>
    </div>
  );
}
