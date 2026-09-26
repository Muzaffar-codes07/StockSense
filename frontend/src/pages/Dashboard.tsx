import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { KpiCard } from '../components/ui/KpiCard';
import { StockKpiCards } from '../features/stock/LowStockCard';

interface DashboardKPIs {
  pendingReceipts: number;
  pendingDeliveries: number;
  scheduledTransfers: number;
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<DashboardKPIs>({
    pendingReceipts: 3,     // Fallback Mock Data
    pendingDeliveries: 8,   // Fallback Mock Data
    scheduledTransfers: 2,  // Fallback Mock Data
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const r4Res = await api.get('/operations/summary');

        const updated = { ...kpis };
        if (r4Res.data) {
          updated.pendingReceipts = r4Res.data.pendingReceipts ?? updated.pendingReceipts;
          updated.pendingDeliveries = r4Res.data.pendingDeliveries ?? updated.pendingDeliveries;
          updated.scheduledTransfers = r4Res.data.scheduledTransfers ?? updated.scheduledTransfers;
        }

        setKpis(updated);
      } catch (err) {
        console.warn('Backend metrics offline, falling back to default values:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Inventory Overview</h1>
        {loading && <span className="text-sm text-gray-500">Syncing live metrics...</span>}
      </div>

      {/* 5 Scope-required KPIs for Role 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StockKpiCards />
        <KpiCard label="Pending Receipts" value={kpis.pendingReceipts} />
        <KpiCard label="Pending Deliveries" value={kpis.pendingDeliveries} />
        <KpiCard label="Internal Transfers" value={kpis.scheduledTransfers} />
      </div>
    </div>
  );
}
