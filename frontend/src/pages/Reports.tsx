import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileBarChart, PieChart } from 'lucide-react';
import { Button, Card, CardHeader, ChipGroup, EmptyState, ErrorState, Notice, Skeleton, StockStatusBadge, Table, usePageMeta, type Column } from '@/components/ui';
import { AreaChart, Donut, Legend, SegmentBar } from '@/components/charts/Charts';
import { useMoveHistory } from '@/features/operations/hooks';
import { formatMoney, formatQty } from '@/features/stock/format';
import { useStockList } from '@/features/stock/hooks';
import type { StockRow } from '@/features/stock/types';
import { dayKey, formatShortDate } from '@/lib/format';
import { CHART, MOVE_TYPE } from '@/lib/status';
import type { MoveType, StockMove } from '@/lib/operations';

const PALETTE = [CHART.onHand, CHART.available, CHART.forecast, CHART.reserved, CHART.accent, CHART.incoming];

export function Reports() {
  usePageMeta('Reports', 'Valuation and activity, calculated from live data.');
  return (
    <div className="space-y-6">
      <ValuationSection />
      <ActivitySection />
      <Card tone="dove">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-white text-sienna shadow-card" aria-hidden>
              <FileBarChart className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink">Exports and scheduled reports</p>
              <p className="text-[13px] text-ink-2">Not connected yet — the API has no report or export endpoints.</p>
            </div>
          </div>
          <Button variant="outline" icon={<Download className="h-4 w-4" />} disabled title="Not connected yet">
            Export CSV
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ValuationSection() {
  const stock = useStockList({ pageSize: 100 });
  const rows: StockRow[] = useMemo(() => (Array.isArray(stock.data?.data) ? stock.data!.data : []), [stock.data]);
  const truncated = (stock.data?.total ?? 0) > rows.length;

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.categoryName ?? 'Uncategorised', (m.get(r.categoryName ?? 'Uncategorised') ?? 0) + Math.max(0, r.onHand) * r.unitCost));
    const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
    return [...top, ...(rest > 0 ? [['Other', rest] as [string, number]] : [])].map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));
  }, [rows]);
  const total = byCategory.reduce((s, c) => s + c.value, 0);

  const topProducts = useMemo(() => [...rows].sort((a, b) => b.onHand * b.unitCost - a.onHand * a.unitCost).slice(0, 8), [rows]);
  const maxValue = Math.max(1, ...topProducts.map((r) => r.onHand * r.unitCost));

  const columns: Column<StockRow>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (r) => (
        <Link to={`/products/${r.id}`} className="block min-w-0">
          <span className="block truncate font-semibold text-ink hover:text-sienna">{r.name}</span>
          <span className="block font-mono text-[12px] text-ink-3">{r.sku}</span>
        </Link>
      ),
    },
    { key: 'onHand', header: 'On hand', align: 'right', render: (r) => <span className="tabular">{`${formatQty(r.onHand)} ${r.uom}`}</span> },
    {
      key: 'value',
      header: 'Value',
      render: (r) => (
        <div className="flex items-center gap-3">
          <SegmentBar className="w-24" max={maxValue} ariaLabel={`${r.name} value share`} parts={[{ label: 'Value', value: Math.max(0, r.onHand * r.unitCost), color: CHART.onHand }]} />
          <span className="tabular font-medium">{formatMoney(Math.max(0, r.onHand) * r.unitCost)}</span>
        </div>
      ),
    },
    { key: 'status', header: 'Status', hideOnMobile: true, render: (r) => <StockStatusBadge status={r.status} /> },
  ];

  if (stock.isError) {
    return (
      <Card>
        <ErrorState message={stock.error.message} onRetry={() => stock.refetch()} />
      </Card>
    );
  }

  return (
    <>
      {truncated && <Notice tone="info">Valuation covers the first {rows.length} of {stock.data?.total} products — a server-side report endpoint would make it complete.</Notice>}
      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader title="Inventory value by category" subtitle="On hand × per unit cost" />
          {stock.isLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : total === 0 ? (
            <EmptyState compact icon={PieChart} title="No stock value yet" description="Value appears once products have stock and a unit cost." />
          ) : (
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <Donut
                segments={byCategory}
                size={156}
                ariaLabel={`Inventory value ${formatMoney(total)} across ${byCategory.length} categories`}
                center={
                  <div>
                    <p className="tabular text-[17px] font-bold text-ink">{formatMoney(total)}</p>
                    <p className="text-[11.5px] text-ink-2">total value</p>
                  </div>
                }
              />
              <Legend className="w-full flex-1" items={byCategory.map((c) => ({ label: c.label, color: c.color, value: formatMoney(c.value) }))} />
            </div>
          )}
        </Card>
        <Card padded={false} className="overflow-hidden xl:col-span-7">
          <CardHeader className="mb-0 px-6 pb-4 pt-6" title="Most valuable stock" subtitle="Top products by value on hand" />
          <Table plain caption="Most valuable stock" columns={columns} rows={topProducts} loading={stock.isLoading} empty="No products yet" />
        </Card>
      </div>
    </>
  );
}

const TYPES = Object.keys(MOVE_TYPE) as MoveType[];
const TYPE_COLOR: Record<MoveType, string> = { RECEIPT: CHART.onHand, DELIVERY: CHART.available, INTERNAL: CHART.accent, ADJUSTMENT: CHART.reserved };

function ActivitySection() {
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const days = Number(range);
  const since = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1));
    return d;
  }, [days]);
  const moves = useMoveHistory({ startDate: since.toISOString(), pageSize: 100 });
  const rows: StockMove[] = useMemo(() => (Array.isArray(moves.data?.data) ? moves.data!.data : []), [moves.data]);
  const truncated = (moves.data?.total ?? 0) > rows.length;

  const byType = useMemo(() => TYPES.map((t) => ({ label: MOVE_TYPE[t].label, value: rows.filter((m) => m.moveType === t).length, color: TYPE_COLOR[t] })), [rows]);
  const series = useMemo(() => {
    const buckets = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      buckets.set(dayKey(d), 0);
    }
    rows.forEach((m) => {
      const k = dayKey(new Date(m.doneAt));
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
    });
    return [...buckets.entries()].map(([k, v]) => {
      const [y, mo, d] = k.split('-').map(Number);
      return { label: formatShortDate(new Date(y, mo - 1, d)), value: v };
    });
  }, [rows, days, since]);
  const max = Math.max(1, ...byType.map((t) => t.value));

  return (
    <Card>
      <CardHeader
        title="Movement activity"
        subtitle={truncated ? `Latest 100 of ${moves.data?.total} movements in this period` : 'Validated stock movements per day'}
        actions={<ChipGroup label="Activity range" value={range} onChange={setRange} options={[{ value: '7', label: '7D' }, { value: '30', label: '30D' }, { value: '90', label: '90D' }]} />}
      />
      {moves.isError ? (
        <ErrorState compact message={moves.error.message} onRetry={() => moves.refetch()} />
      ) : moves.isLoading ? (
        <Skeleton className="h-52 w-full" />
      ) : (
        <div className="grid gap-8 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <AreaChart data={series} height={180} labelEvery={Math.ceil(days / 8)} formatValue={(n) => `${n} move${n === 1 ? '' : 's'}`} ariaLabel={`Movements per day over the last ${days} days`} />
          </div>
          <ul className="space-y-4 xl:col-span-4">
            {byType.map((t) => (
              <li key={t.label}>
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span className="text-ink-2">{t.label}</span>
                  <span className="tabular font-semibold text-ink">{t.value}</span>
                </div>
                <SegmentBar max={max} ariaLabel={`${t.label}: ${t.value} movements`} parts={[{ label: t.label, value: t.value, color: t.color }]} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
