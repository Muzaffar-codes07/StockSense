import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterBar, Pager, SelectField, Table, type Column } from '@/components/ui';
import { useCategories } from '@/features/products/hooks';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { formatMoney, formatQty } from './format';
import { useStockAlerts, useStockList } from './hooks';
import { STATUS_OPTIONS, StatusBadge } from './StatusBadge';
import { StockBreakdownModal } from './StockBreakdownModal';
import type { StockRow, StockStatus } from './types';

const PAGE_SIZE = 20;
const isStatus = (v: string | null): v is StockStatus => v === 'OK' || v === 'LOW' || v === 'OUT';

export function StockPage({ onUpdate }: { onUpdate?: (row: StockRow) => void }) {
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

  const out = alerts.data?.filter((r) => r.status === 'OUT').length ?? 0;
  const low = alerts.data?.filter((r) => r.status === 'LOW').length ?? 0;

  const columns: Column<StockRow>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.name}</p>
          <p className="font-mono text-xs text-slate-400">{r.sku}</p>
        </div>
      ),
    },
    { key: 'unitCost', header: 'Per unit cost', render: (r) => formatMoney(r.unitCost) },
    { key: 'onHand', header: 'On hand', render: (r) => `${formatQty(r.onHand)} ${r.uom}` },
    {
      key: 'freeToUse',
      header: 'Free to use',
      render: (r) => (
        <button
          type="button"
          onClick={() => setExplained(r)}
          className={`underline decoration-dotted underline-offset-4 hover:text-brand-600 ${r.freeToUse < 0 ? 'font-medium text-red-600' : ''}`}
          title={
            r.reserved > 0
              ? `${formatQty(r.reserved)} ${r.uom} reserved by pending deliveries. Click for the breakdown.`
              : 'Click for the breakdown'
          }
        >
          {formatQty(r.freeToUse)} {r.uom}
        </button>
      ),
    },
    {
      key: 'forecast',
      header: 'Forecast',
      render: (r) => (
        <span
          className={r.forecast < 0 ? 'font-medium text-red-600' : undefined}
          title={`${formatQty(r.onHand)} on hand + ${formatQty(r.incoming)} incoming − ${formatQty(r.reserved)} reserved`}
        >
          {formatQty(r.forecast)} {r.uom}
          {r.incoming > 0 && (
            <span className="block text-xs text-emerald-600">+{formatQty(r.incoming)} incoming</span>
          )}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    ...(onUpdate
      ? [
          {
            key: 'actions',
            header: '',
            render: (r: StockRow) => (
              <button
                type="button"
                className="text-sm font-medium text-brand-700 hover:underline"
                onClick={() => onUpdate(r)}
              >
                Update stock
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Stock</h1>

      {out + low > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>
            <strong>{out + low}</strong> product{out + low === 1 ? '' : 's'} need attention: {out} out of stock,{' '}
            {low} low.
          </span>
          <span className="flex gap-3">
            {out > 0 && (
              <button type="button" className="font-medium underline" onClick={() => setStatus('OUT')}>
                Show out of stock
              </button>
            )}
            {low > 0 && (
              <button type="button" className="font-medium underline" onClick={() => setStatus('LOW')}>
                Show low stock
              </button>
            )}
          </span>
        </div>
      )}

      <FilterBar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
      >
        <div className="w-48">
          <SelectField
            aria-label="Category"
            placeholder="All categories"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
        <div className="w-44">
          <SelectField
            aria-label="Stock status"
            placeholder="Any status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StockStatus | '')}
            options={STATUS_OPTIONS}
          />
        </div>
      </FilterBar>

      {stock.error ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{stock.error.message}</p>
      ) : (
        <Table
          columns={columns}
          rows={stock.data?.data ?? []}
          empty={stock.isLoading ? 'Loading…' : 'No products match these filters'}
        />
      )}
      <Pager page={page} totalPages={stock.data?.totalPages ?? 1} onPage={setPage} />
      <StockBreakdownModal row={explained} onClose={() => setExplained(null)} />
    </div>
  );
}
