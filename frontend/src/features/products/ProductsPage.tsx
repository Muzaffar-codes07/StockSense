import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, Plus } from 'lucide-react';
import {
  Button,
  ChipGroup,
  EmptyState,
  FilterBar,
  Pager,
  SelectField,
  StockStatusBadge,
  Table,
  usePageMeta,
  useToast,
  type Column,
} from '@/components/ui';
import { formatMoney, formatQty } from '@/features/stock/format';
import { STATUS_OPTIONS } from '@/features/stock/StatusBadge';
import type { StockRow, StockStatus } from '@/features/stock/types';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { CategoriesPanel } from './CategoriesPanel';
import { ProductSheet } from './ProductForm';
import { useCategories, useProducts } from './hooks';

const PAGE_SIZE = 20;

export function ProductList({ onCreate }: { onCreate?: () => void }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<StockStatus | ''>('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const products = useProducts({
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    status: status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const categories = useCategories();
  const activeCount = (search ? 1 : 0) + (categoryId ? 1 : 0) + (status ? 1 : 0);

  const columns: Column<StockRow>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-raspberry text-[12px] font-semibold uppercase text-ondark" aria-hidden>
            {r.name.slice(0, 2)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink">{r.name}</span>
            <span className="block font-mono text-[12px] text-ink-3">{r.sku}</span>
          </span>
        </div>
      ),
    },
    { key: 'categoryName', header: 'Category', hideOnMobile: true, render: (r) => <span className="text-ink-2">{r.categoryName ?? '—'}</span> },
    { key: 'uom', header: 'Unit', hideOnMobile: true, render: (r) => <span className="text-ink-2">{r.uom}</span> },
    { key: 'unitCost', header: 'Unit cost', align: 'right', hideOnMobile: true, render: (r) => <span className="tabular">{formatMoney(r.unitCost)}</span> },
    { key: 'onHand', header: 'On hand', align: 'right', render: (r) => <span className="tabular font-medium">{`${formatQty(r.onHand)} ${r.uom}`}</span> },
    { key: 'freeToUse', header: 'Free to use', align: 'right', hideOnMobile: true, render: (r) => <span className="tabular text-ink-2">{`${formatQty(r.freeToUse)} ${r.uom}`}</span> },
    { key: 'status', header: 'Status', render: (r) => <StockStatusBadge status={r.status} /> },
  ];

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <div>
      <FilterBar
        search={search}
        onSearch={(v) => reset(() => setSearch(v))}
        activeCount={activeCount}
        onClear={() =>
          reset(() => {
            setSearch('');
            setCategoryId('');
            setStatus('');
          })
        }
        trailing={
          products.data && (
            <span className="text-[13px] text-ink-2">
              <span className="tabular font-semibold text-ink">{products.data.total}</span> product{products.data.total === 1 ? '' : 's'}
            </span>
          )
        }
      >
        <SelectField
          variant="pill"
          aria-label="Category"
          placeholder="All categories"
          value={categoryId}
          onChange={(e) => reset(() => setCategoryId(e.target.value))}
          options={(Array.isArray(categories.data) ? categories.data : []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <SelectField
          variant="pill"
          aria-label="Stock status"
          placeholder="Any status"
          value={status}
          onChange={(e) => reset(() => setStatus(e.target.value as StockStatus | ''))}
          options={STATUS_OPTIONS}
        />
      </FilterBar>

      <Table
        caption="Products"
        columns={columns}
        rows={products.data?.data ?? []}
        loading={products.isLoading}
        error={products.error?.message}
        onRetry={() => products.refetch()}
        onRowClick={(r) => navigate(`/products/${r.id}`)}
        empty={
          activeCount ? (
            <EmptyState compact icon={Package} title="No products match these filters" description="Try a different search or clear the filters." />
          ) : (
            <EmptyState
              compact
              icon={Package}
              title="No products yet"
              description="Add your first product to start tracking stock."
              action={
                onCreate && (
                  <Button icon={<Plus className="h-4 w-4" />} onClick={onCreate}>
                    New product
                  </Button>
                )
              }
            />
          )
        }
      />
      <Pager page={page} totalPages={products.data?.totalPages ?? 1} onPage={setPage} total={products.data?.total} pageSize={PAGE_SIZE} />
    </div>
  );
}

type Tab = 'products' | 'categories';

export function ProductsPage() {
  usePageMeta('Products', 'Manage your inventory catalogue.');
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'categories' ? 'categories' : 'products';
  const creating = params.get('new') === '1';

  const setTab = (t: Tab) => setParams(t === 'categories' ? { tab: t } : {});
  const openCreate = () => setParams({ new: '1' });
  const closeCreate = () => setParams(tab === 'categories' ? { tab } : {});

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <ChipGroup
          label="Catalogue section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'products', label: 'Products' },
            { value: 'categories', label: 'Categories' },
          ]}
        />
        {tab === 'products' && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            New product
          </Button>
        )}
      </div>
      {tab === 'products' ? <ProductList onCreate={openCreate} /> : <CategoriesPanel />}
      <ProductSheet
        open={creating}
        onClose={closeCreate}
        onSaved={(id) => {
          toast.success('Product created');
          navigate(`/products/${id}`);
        }}
      />
    </div>
  );
}
