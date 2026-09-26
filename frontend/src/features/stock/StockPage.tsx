import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Boxes, SlidersHorizontal } from 'lucide-react';
import { Button, EmptyState, FilterBar, Notice, Pager, SelectField, StockStatusBadge, Table, usePageMeta, type Column } from '@/components/ui';
import { useCategories } from '@/features/products/hooks';
import { cn } from '@/lib/cn';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { formatMoney, formatQty } from './format';
import { useStockAlerts, useStockList } from './hooks';
import { STATUS_OPTIONS } from './StatusBadge';
import { StockBreakdownModal } from './StockBreakdownModal';
import type { StockRow, StockStatus } from './types';

const PAGE_SIZE = 20;
const isStatus = (v: string | null): v is StockStatus => v === 'OK' || v === 'LOW' || v === 'OUT';

export function StockPage({ onUpdate }: { onUpdate?: (row: StockRow) => void }) {
  usePageMeta('Stock', 'On hand, reserved and forecast for every product.');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Case-insensitive, so a hand-typed or shared ?status=low link still filters.
  const statusParam = params.get('status')?.toUpperCase() ?? null;
  const status: StockStatus | '' = isStatus(statusParam) ? statusParam : '';
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [explained, setExplained] = useState<StockRow | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const stock = useStockList({
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    status: status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const alerts = useStockAlerts();
  const categories = useCategories();

  const setStatus = (next: StockStatus | '') => {
    setPage(1);
    setParams(next ? { status: next } : {});
  };

  const alertRows = Array.isArray(alerts.data) ? alerts.data : [];
  const out = alertRows.filter((r) => r.status === 'OUT').length;
  const low = alertRows.filter((r) => r.status === 'LOW').length;
  const activeCount = (search ? 1 : 0) + (categoryId ? 1 : 0) + (status ? 1 : 0);

  const columns: Column<StockRow>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{r.name}</p>
          <p className="font-mono text-[12px] text-ink-3">{r.sku}</p>
        </div>
      ),
    },
    { key: 'categoryName', header: 'Category', hideOnMobile: true, render: (r) => <span className="text-ink-2">{r.categoryName ?? '—'}</span> },
    { key: 'unitCost', header: 'Per unit cost', align: 'right', hideOnMobile: true, render: (r) => <span className="tabular">{formatMoney(r.unitCost)}</span> },
    { key: 'onHand', header: 'On hand', align: 'right', render: (r) => <span className="tabular font-medium">{`${formatQty(r.onHand)} ${r.uom}`}</span> },
    {
      key: 'freeToUse',
      header: 'Free to use',
      align: 'right',
      render: (r) => (
        <button
          type="button"
          onClick={() => setExplained(r)}
          className={cn(
            'tabular rounded-md underline decoration-dove decoration-dotted underline-offset-4 transition-colors hover:text-sienna hover:decoration-sienna',
            r.freeToUse < 0 && 'font-semibold text-danger-fg',
          )}
          title={r.reserved > 0 ? `${formatQty(r.reserved)} ${r.uom} reserved by pending deliveries. Click for the breakdown.` : 'Click for the breakdown'}
        >
          {formatQty(r.freeToUse)} {r.uom}
        </button>
      ),
    },
    {
      key: 'forecast',
      header: 'Forecast',
      align: 'right',
      render: (r) => (
        <span
          className={cn('tabular', r.forecast < 0 && 'font-semibold text-danger-fg')}
          title={`${formatQty(r.onHand)} on hand + ${formatQty(r.incoming)} incoming − ${formatQty(r.reserved)} reserved`}
        >
          {formatQty(r.forecast)} {r.uom}
          {r.incoming > 0 && <span className="block text-[12px] font-medium text-success-fg">+{formatQty(r.incoming)} incoming</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <>
          <StockStatusBadge status={r.status} />
          {r.suggestedQty > 0 && (
            <span
              className="mt-1 block text-[12px] font-medium text-amber-700"
              title={`Forecast ${formatQty(r.forecast)} is at or under the minimum ${formatQty(r.minQty ?? 0)}: order up to ${formatQty(r.maxQty ?? r.minQty ?? 0)}`}
            >
              Reorder {formatQty(r.suggestedQty)} {r.uom}
            </span>
          )}
        </>
      ),
    },
    ...(onUpdate
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (r: StockRow) => (
              <Button variant="ghost" size="sm" icon={<SlidersHorizontal className="h-3.5 w-3.5" />} onClick={() => onUpdate(r)}>
                Update stock
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      {out + low > 0 && (
        <Notice
          tone="warning"
          className="mb-5"
          action={
            <span className="flex gap-3">
              {out > 0 && (
                <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setStatus('OUT')}>
                  Show out of stock
                </button>
              )}
              {low > 0 && (
                <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setStatus('LOW')}>
                  Show low stock
                </button>
              )}
            </span>
          }
        >
          <strong>{out + low}</strong> product{out + low === 1 ? '' : 's'} need attention: {out} out of stock, {low} low.
        </Notice>
      )}

      <FilterBar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        activeCount={activeCount}
        onClear={() => {
          setSearch('');
          setCategoryId('');
          setStatus('');
        }}
        trailing={
          stock.data && (
            <span className="text-[13px] text-ink-2">
              <span className="tabular font-semibold text-ink">{stock.data.total}</span> product{stock.data.total === 1 ? '' : 's'}
            </span>
          )
        }
      >
        <SelectField
          variant="pill"
          aria-label="Category"
          placeholder="All categories"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          options={(Array.isArray(categories.data) ? categories.data : []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <SelectField
          variant="pill"
          aria-label="Stock status"
          placeholder="Any status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StockStatus | '')}
          options={STATUS_OPTIONS}
        />
      </FilterBar>

      <Table
        caption="Stock levels"
        columns={columns}
        rows={stock.data?.data ?? []}
        loading={stock.isLoading}
        error={stock.error?.message}
        onRetry={() => stock.refetch()}
        onRowClick={(r) => navigate(`/products/${r.id}`)}
        empty={
          <EmptyState
            compact
            icon={Boxes}
            title={activeCount ? 'No products match these filters' : 'No stock yet'}
            description={activeCount ? 'Try a different search or clear the filters.' : 'Products appear here once they are added to the catalogue.'}
          />
        }
      />
      <Pager page={page} totalPages={stock.data?.totalPages ?? 1} onPage={setPage} total={stock.data?.total} pageSize={PAGE_SIZE} />
      <StockBreakdownModal row={explained} onClose={() => setExplained(null)} />
    </div>
  );
}
