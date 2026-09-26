import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MoveHistory } from './MoveHistory';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
const get = vi.mocked(api.get);

const move = (n: number) => ({
  id: `m${n}`,
  productId: 'p1',
  product: { id: 'p1', name: `Product ${n}`, sku: `SKU-${n}`, uom: 'unit' },
  qty: 1,
  moveType: 'RECEIPT',
  fromLocationId: null,
  toLocationId: 'l1',
  fromLocation: null,
  toLocation: { id: 'l1', name: 'Main Store' },
  docType: 'receipt',
  docId: `d000000${n}`,
  doneAt: '2026-09-26T08:00:00Z',
  createdAt: '2026-09-26T08:00:00Z',
});

function renderPage() {
  get.mockImplementation((async (url: string, config?: { params?: { page?: number } }) => {
    if (url === '/stock/locations') {
      return {
        data: [
          { id: 'main', name: 'Main Store', type: 'STOCK', warehouseName: 'Main Warehouse' },
          { id: 'rack', name: 'Production Rack', type: 'PRODUCTION', warehouseName: 'Main Warehouse' },
        ],
      };
    }
    const page = config?.params?.page ?? 1;
    return { data: { data: [move(page)], page, pageSize: 50, total: 120, totalPages: 3 } };
  }) as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MoveHistory />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Move History paging (audit P1)', () => {
  beforeEach(() => {
    get.mockReset();
  });

  const lastParams = () => (get.mock.calls.filter(([url]) => url === '/operations/moves').at(-1)?.[1] as { params: Record<string, unknown> }).params;

  it('pages through the whole ledger instead of stopping at the first 50', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 2 }));
    expect(await screen.findByText('Product 2')).toBeInTheDocument();
  });

  it('goes back to page 1 when the filter changes', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 2 }));
    await screen.findByRole('option', { name: 'Main Warehouse / Production Rack' });
    await userEvent.selectOptions(screen.getByLabelText('Location'), 'rack');
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 1, locationId: 'rack' }));
  });

  it('filters by location (warehouse / location filter from the brief)', async () => {
    renderPage();
    await screen.findByRole('option', { name: 'Main Warehouse / Production Rack' });
    await userEvent.selectOptions(screen.getByLabelText('Location'), 'rack');
    await waitFor(() => expect(lastParams()).toMatchObject({ locationId: 'rack', page: 1 }));
  });
});
