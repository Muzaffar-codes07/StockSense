import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Package,
  Truck,
} from 'lucide-react';
import {
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  KpiCard,
  Notice,
  Section,
  Skeleton,
  StockStatusBadge,
  usePageMeta,
} from '@/components/ui';
import { AreaChart, Donut, Legend, SegmentBar } from '@/components/charts/Charts';
import { useStockAlerts, useStockKpis, useStockList } from '@/features/stock/hooks';
import { formatMoney, formatQty } from '@/features/stock/format';
import { useMoveHistory, useOpsKpis } from '@/features/operations/hooks';
import { CHART, MOVE_TYPE } from '@/lib/status';
import { dayKey, formatShortDate, greeting, timeAgo } from '@/lib/format';
import type { CurrentUser } from '@/lib/auth';
import type { StockMove } from '@/lib/operations';
import type { StockRow } from '@/features/stock/types';

export default function Dashboard() {
  const qc = useQueryClient();
  const user = qc.getQueryData<CurrentUser>(['auth', 'me']);
  usePageMeta('Overview', `${greeting()}${user?.name ? `, ${user.name.split(' ')[0]}` : ''} — here's what needs your attention.`);

  const stock = useStockKpis();
  const ops = useOpsKpis();
  const count = (n: number | undefined) => (n === undefined ? '—' : formatQty(n));

  // Live values only: a tile shows "—" until real data arrives, never a guess.
  const kpiFailed = stock.isError || ops.isError;
  const low = stock.data?.lowStock;
  const out = stock.data?.outOfStock;

  return (
    <div className="space-y-9">
      {kpiFailed && <Notice tone="warning">Couldn't load live metrics. Is the StockSense API running?</Notice>}

      <Section title="Inventory at a glance">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            label="Products in Stock"
            value={count(stock.data?.totalProductsInStock)}
            icon={Package}
            tone="dove"
            to="/stock"
            context={stock.data ? `${formatMoney(stock.data.stockValue)} value` : undefined}
            loading={stock.isLoading}
          />
          <KpiCard
            label="Low / Out of Stock"
            value={low === undefined || out === undefined ? '—' : `${low} / ${out}`}
            icon={AlertTriangle}
            tone="surface"
            to={out ? '/stock?status=OUT' : '/stock?status=LOW'}
            accent={out ? 'danger' : low ? 'warning' : 'success'}
            context={stock.data ? (out || low ? `${out} out · ${low} low` : 'All above reorder point') : undefined}
            loading={stock.isLoading}
          />
          <KpiCard
            label="Pending Receipts"
            value={count(ops.data?.pendingReceipts)}
            icon={ArrowDownLeft}
            tone="mist"
            to="/operations/receipts"
            context={ops.data ? 'Incoming, not yet received' : undefined}
            loading={ops.isLoading}
          />
          <KpiCard
            label="Pending Deliveries"
            value={count(ops.data?.pendingDeliveries)}
            icon={ArrowUpRight}
            tone="blush"
            to="/operations/deliveries"
            context={ops.data ? 'Orders waiting to ship' : undefined}
            loading={ops.isLoading}
          />
          <KpiCard
            label="Internal Transfers"
            value={count(ops.data?.scheduledTransfers)}
            icon={ArrowLeftRight}
            tone="surface"
            to="/operations/transfers"
            context={ops.data ? 'Scheduled between locations' : undefined}
            loading={ops.isLoading}
          />
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-12">
        <ActivityCard className="xl:col-span-7" stockValue={stock.data?.stockValue} />
        <HealthCard className="xl:col-span-5" kpis={stock.data} loading={stock.isLoading} failed={stock.isError} />
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <RecentMoves className="xl:col-span-8" />
        <AttentionCard className="xl:col-span-4" />
      </div>

      <StockPosition />
    </div>
  );
}

/* ---------------------------------------------------------------- activity */

const RANGES = [
  { value: '7', label: '7D' },
  { value: '14', label: '14D' },
  { value: '30', label: '30D' },
] as const;

function ActivityCard({ className, stockValue }: { className?: string; stockValue?: number }) {
  const [range, setRange] = useState<'7' | '14' | '30'>('14');
  const days = Number(range);
  const since = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1));
    return d;
  }, [days]);
  const moves = useMoveHistory({ startDate: since.toISOString(), pageSize: 100 });

  const series = useMemo(() => {
    const buckets = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      buckets.set(dayKey(d), 0);
    }
    for (const m of Array.isArray(moves.data?.data) ? moves.data!.data : []) {
      const k = dayKey(new Date(m.doneAt));
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
    }
    return Array.from(buckets.entries()).map(([k, v]) => {
      const [y, mo, d] = k.split('-').map(Number);
      return { label: formatShortDate(new Date(y, mo - 1, d)), value: v };
    });
  }, [moves.data, days, since]);

  const total = series.reduce((s, p) => s + p.value, 0);
  const truncated = (moves.data?.total ?? 0) > (moves.data?.data?.length ?? 0);

  return (
    <Card tone="mist" className={className}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-ink-2">Inventory value</p>
          <p className="tabular mt-1 text-[32px] font-bold leading-9 tracking-[-0.035em] text-ink">
            {stockValue === undefined ? '—' : formatMoney(stockValue)}
          </p>
          <p className="mt-1 text-[13px] text-ink-2">
            {moves.data ? (
              <>
                <span className="font-semibold text-ink">{total}</span> stock movement{total === 1 ? '' : 's'} in the last {days} days
                {truncated && ' (latest 100 shown)'}
              </>
            ) : (
              'Stock movements over time'
            )}
          </p>
        </div>
        <ChipGroup label="Activity range" value={range} onChange={setRange} options={[...RANGES]} />
      </div>
      {moves.isError ? (
        <ErrorState compact message={moves.error.message} onRetry={() => moves.refetch()} />
      ) : moves.isLoading ? (
        <Skeleton className="h-[196px] w-full rounded-2xl" />
      ) : (
        <AreaChart
          data={series}
          height={168}
          formatValue={(n) => `${n} move${n === 1 ? '' : 's'}`}
          labelEvery={days > 14 ? 5 : days > 7 ? 2 : 1}
          ariaLabel={`Stock movements per day over the last ${days} days, ${total} in total`}
        />
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ health */

function HealthCard({
  className,
  kpis,
  loading,
  failed,
}: {
  className?: string;
  kpis?: { totalProductsInStock: number; lowStock: number; outOfStock: number };
  loading: boolean;
  failed: boolean;
}) {
  const healthy = kpis ? Math.max(0, kpis.totalProductsInStock - kpis.lowStock) : 0;
  const segments = kpis
    ? [
        { label: 'Healthy', value: healthy, color: CHART.onHand },
        { label: 'Low stock', value: kpis.lowStock, color: 'rgb(var(--ss-warning))' },
        { label: 'Out of stock', value: kpis.outOfStock, color: 'rgb(var(--ss-danger))' },
      ]
    : [];
  const total = segments.reduce((s, x) => s + x.value, 0);

  return (
    <Card className={className}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-title text-ink">Stock health</h2>
          <p className="mt-1 text-[13px] text-ink-2">Active products by reorder status</p>
        </div>
        <Link to="/stock" className="inline-flex items-center gap-1 text-[13px] font-medium text-sienna hover:underline">
          View stock <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      {failed ? (
        <p className="py-10 text-center text-[13px] text-ink-2">Stock health is unavailable right now.</p>
      ) : loading || !kpis ? (
        <div className="flex items-center gap-8">
          <Skeleton className="h-[160px] w-[160px] rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8 sm:flex-row">
          <Donut
            segments={segments}
            size={164}
            ariaLabel={`${healthy} healthy, ${kpis.lowStock} low, ${kpis.outOfStock} out of stock`}
            center={
              <div>
                <p className="tabular text-[28px] font-bold leading-8 tracking-tight text-ink">{total}</p>
                <p className="text-[12px] text-ink-2">products</p>
              </div>
            }
          />
          <Legend
            className="w-full flex-1"
            items={segments.map((s) => ({ label: s.label, color: s.color, value: s.value }))}
          />
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ recent moves */

function RecentMoves({ className }: { className?: string }) {
  const moves = useMoveHistory({ pageSize: 6 });
  const rows: StockMove[] = Array.isArray(moves.data?.data) ? moves.data!.data : [];

  return (
    <Card className={`min-w-0 ${className ?? ''}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-title text-ink">Recent movements</h2>
          <p className="mt-1 text-[13px] text-ink-2">The latest entries in the stock ledger</p>
        </div>
        <Link to="/move-history" className="inline-flex items-center gap-1 text-[13px] font-medium text-sienna hover:underline">
          Move history <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      {moves.isError ? (
        <ErrorState compact message={moves.error.message} onRetry={() => moves.refetch()} />
      ) : moves.isLoading ? (
        <div className="space-y-4 pt-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState compact icon={Truck} title="No movements yet" description="Validated receipts, deliveries, transfers and counts appear here." />
      ) : (
        <ul className="-mx-2">
          {rows.map((m) => (
            <MoveRow key={m.id} move={m} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function MoveRow({ move }: { move: StockMove }) {
  const t = MOVE_TYPE[move.moveType] ?? MOVE_TYPE.RECEIPT;
  const Icon = t.icon;
  const qty = Number(move.qty);
  const sign = move.moveType === 'RECEIPT' ? '+' : move.moveType === 'DELIVERY' ? '−' : move.toLocationId && !move.fromLocationId ? '+' : move.fromLocationId && !move.toLocationId ? '−' : '';
  return (
    <li className="flex items-center gap-4 rounded-[14px] px-2 py-2.5 transition-colors hover:bg-dove/[0.12]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-raspberry text-ondark" aria-hidden>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-ink">{move.product?.name ?? 'Product'}</p>
        <p className="truncate text-[12px] text-ink-2">
          {t.label} · {move.fromLocation?.name ?? 'Outside'} → {move.toLocation?.name ?? 'Outside'}
        </p>
      </div>
      <div className="hidden w-28 text-right sm:block">
        <p className="tabular text-[14px] font-semibold text-ink">
          {sign}
          {formatQty(qty)} <span className="font-normal text-ink-2">{move.product?.uom}</span>
        </p>
        <p className="text-[12px] text-ink-2">{move.createdBy?.name ?? 'System'}</p>
      </div>
      <p className="w-20 shrink-0 text-right text-[12px] text-ink-2">{timeAgo(move.doneAt)}</p>
    </li>
  );
}

/* ---------------------------------------------------------------- attention */

/** The one dark, high-emphasis module on the screen: what to fix today. */
function AttentionCard({ className }: { className?: string }) {
  const alerts = useStockAlerts();
  const rows: StockRow[] = Array.isArray(alerts.data) ? alerts.data : [];
  const out = rows.filter((r) => r.status === 'OUT').length;

  return (
    <Card tone="raspberry" className={`flex flex-col overflow-hidden ${className ?? ''}`}>
      <svg className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 opacity-[0.07]" viewBox="0 0 32 32" aria-hidden>
        <path d="M16 3.5 27.5 10 16 16.5 4.5 10Z M4.5 10 16 16.5V29.5L4.5 23Z M27.5 10 16 16.5V29.5L27.5 23Z" fill="none" stroke="white" strokeWidth="0.6" />
      </svg>
      <div className="relative">
        <p className="text-[13px] font-medium text-ondark/60">Needs attention</p>
        <h2 className="mt-1.5 text-[26px] font-bold leading-8 tracking-[-0.03em] text-white">
          {alerts.isLoading
            ? 'Checking stock…'
            : alerts.isError
              ? 'Alerts unavailable'
              : rows.length === 0
                ? 'Stock is healthy'
                : `${rows.length} product${rows.length === 1 ? '' : 's'} to restock`}
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-ondark/65">
          {rows.length > 0
            ? `${out} out of stock, ${rows.length - out} at or below their reorder minimum.`
            : alerts.isError
              ? "We couldn't reach the stock service. Try again shortly."
              : 'Every product is above its reorder point.'}
        </p>
      </div>
      {rows.length > 0 && (
        <ul className="relative mt-5 space-y-1">
          {rows.slice(0, 4).map((r) => (
            <li key={r.id}>
              <Link to={`/products/${r.id}`} className="flex items-center justify-between gap-3 rounded-[12px] px-3 py-2 transition-colors hover:bg-white/[0.06]">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-white">{r.name}</span>
                  <span className="block text-[12px] text-ondark/55">
                    {formatQty(r.onHand)} {r.uom} on hand{r.incoming > 0 ? ` · +${formatQty(r.incoming)} incoming` : ''}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === 'OUT' ? 'bg-danger/30 text-[#F3C9C9]' : 'bg-warning/30 text-[#F0DDBF]'}`}
                >
                  {r.status === 'OUT' ? 'Out' : 'Low'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="relative mt-auto pt-6">
        <Link
          to={rows.length > 0 ? '/stock?status=LOW' : '/stock'}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-dove px-5 text-[13px] font-semibold text-raspberry transition-colors hover:bg-white"
        >
          {rows.length > 0 ? 'Review stock' : 'View stock'} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------ stock position */

const SEVERITY = { OUT: 0, LOW: 1, OK: 2 } as const;

function StockPosition() {
  const list = useStockList({ pageSize: 100 });
  const rows = useMemo(() => {
    const all: StockRow[] = Array.isArray(list.data?.data) ? list.data!.data : [];
    return [...all].sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status] || a.name.localeCompare(b.name)).slice(0, 8);
  }, [list.data]);

  return (
    <Section
      title="Stock position"
      description="Free to use, reserved and incoming per product — the tick marks each reorder minimum."
      actions={
        <Link to="/stock" className="inline-flex items-center gap-1 text-[13px] font-medium text-sienna hover:underline">
          All stock <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      }
    >
      <Card>
        <Legend
          className="mb-6 flex flex-wrap gap-x-6 gap-y-2 space-y-0"
          items={[
            { label: 'Free to use', color: CHART.onHand },
            { label: 'Reserved', color: CHART.reserved },
            { label: 'Incoming', color: CHART.incoming },
          ]}
        />
        {list.isError ? (
          <ErrorState compact message={list.error.message} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <div className="space-y-5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState compact icon={CheckCircle2} title="No products yet" description="Add products to see their stock position." />
        ) : (
          <ul className="grid gap-x-10 gap-y-5 lg:grid-cols-2">
            {rows.map((r) => {
              const free = Math.max(0, r.freeToUse);
              const reserved = Math.min(r.reserved, r.onHand);
              const max = Math.max(r.onHand + r.incoming, r.minQty ?? 0, r.maxQty ?? 0, 1);
              return (
                <li key={r.id}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <Link to={`/products/${r.id}`} className="min-w-0 truncate text-[13.5px] font-semibold text-ink hover:text-sienna">
                      {r.name}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular text-[12px] text-ink-2">
                        {formatQty(r.onHand)} {r.uom}
                      </span>
                      <StockStatusBadge status={r.status} />
                    </span>
                  </div>
                  <SegmentBar
                    max={max}
                    marker={r.minQty}
                    ariaLabel={`${r.name}: ${formatQty(free)} free, ${formatQty(reserved)} reserved, ${formatQty(r.incoming)} incoming`}
                    parts={[
                      { label: 'Free to use', value: free, color: CHART.onHand },
                      { label: 'Reserved', value: reserved, color: CHART.reserved },
                      { label: 'Incoming', value: r.incoming, color: CHART.incoming },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </Section>
  );
}
