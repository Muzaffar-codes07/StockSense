import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilterBar, Pager, SelectField, Table, type Column } from '@/components/ui';
import { formatQty } from '@/features/stock/format';
import { STATUS_OPTIONS, StatusBadge } from '@/features/stock/StatusBadge';
import type { StockRow, StockStatus } from '@/features/stock/types';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { CategoriesPanel } from './CategoriesPanel';
import { useCategories, useProducts } from './hooks';

const PAGE_SIZE = 20;

export function ProductList() {
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

  const columns: Column<StockRow>[] = [
    { key: 'sku', header: 'SKU', render: (r) => <span className="font-mono text-xs">{r.sku}</span> },
    {
      key: 'name',
      header: 'Product',
      render: (r) => (
        <button
          type="button"
          className="font-medium text-brand-700 hover:underline"
          onClick={() => navigate(`/products/${r.id}`)}
        >
          {r.name}
        </button>
      ),
    },
    { key: 'categoryName', header: 'Category', render: (r) => r.categoryName ?? '—' },
    { key: 'onHand', header: 'On hand', render: (r) => `${formatQty(r.onHand)} ${r.uom}` },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
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
            onChange={(e) => {
              setStatus(e.target.value as StockStatus | '');
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
        </div>
      </FilterBar>

      {products.error ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{products.error.message}</p>
      ) : (
        <Table
          columns={columns}
          rows={products.data?.data ?? []}
          empty={products.isLoading ? 'Loading…' : 'No products match these filters'}
        />
      )}
      <Pager page={page} totalPages={products.data?.totalPages ?? 1} onPage={setPage} />
    </div>
  );
}

export function ProductsPage() {
  const [tab, setTab] = useState<'products' | 'categories'>('products');
  const tabClass = (active: boolean) =>
    `-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
      active ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
    }`;
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Products</h1>
        {tab === 'products' && (
          <Link
            to="/products/new"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            New product
          </Link>
        )}
      </div>
      <div className="mb-4 flex border-b border-slate-200">
        <button type="button" className={tabClass(tab === 'products')} onClick={() => setTab('products')}>
          Products
        </button>
        <button type="button" className={tabClass(tab === 'categories')} onClick={() => setTab('categories')}>
          Categories
        </button>
      </div>
      {tab === 'products' ? <ProductList /> : <CategoriesPanel />}
    </div>
  );
}
