import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { ProductFormPage } from './ProductFormPage';
import type { ProductDetail } from './types';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
const get = vi.mocked(api.get);

const product = (isActive: boolean): ProductDetail => ({
  id: 'p1',
  name: 'Oak Plank',
  sku: 'OAK-PLANK',
  uom: 'm',
  unitCost: 12,
  isActive,
  category: null,
  reorderRule: null,
  locations: [],
  createdAt: '',
  updatedAt: '',
});

function renderProduct(detail: ProductDetail) {
  get.mockImplementation(async (url: string) => {
    if (url === '/products/p1') return { data: detail };
    if (url === '/categories' || url === '/stock/locations') return { data: [] };
    throw new Error(`404 ${url}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/products/p1']}>
        <Routes>
          <Route path="/products/:id" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProductFormPage archived state', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('marks an archived product and does not offer to archive it again', async () => {
    renderProduct(product(false));
    expect(await screen.findByText('Archived')).toBeInTheDocument();
    expect(screen.getByText(/hidden from stock lists/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive product' })).not.toBeInTheDocument();
  });

  it('shows no badge and offers Archive for an active product', async () => {
    renderProduct(product(true));
    expect(await screen.findByRole('button', { name: 'Archive product' })).toBeInTheDocument();
    expect(screen.queryByText('Archived')).not.toBeInTheDocument();
  });
});
