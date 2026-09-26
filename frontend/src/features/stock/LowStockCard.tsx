import { Link } from 'react-router-dom';
import { KpiCard } from '@/components/ui';
import { formatQty } from './format';
import { useStockKpis } from './hooks';

/** Role 3's two dashboard tiles. Role 2 drops these into the Dashboard grid. */
export function StockKpiCards() {
  const { data } = useStockKpis();
  return (
    <>
      <Link to="/stock" className="block">
        <KpiCard label="Total in Stock" value={data ? formatQty(data.totalProductsInStock) : '—'} />
      </Link>
      <Link to={data && data.outOfStock > 0 ? '/stock?status=OUT' : '/stock?status=LOW'} className="block">
        <KpiCard
          label="Low / Out of Stock"
          value={data ? `${data.lowStock} / ${data.outOfStock}` : '—'}
          accent={data && data.outOfStock > 0 ? 'danger' : 'warning'}
        />
      </Link>
    </>
  );
}
