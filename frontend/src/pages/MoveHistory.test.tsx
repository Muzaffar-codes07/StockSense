import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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
  get.mockImplementation((async (_url: string, config?: { params?: { page?: number } }) => {
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

  it('pages through the whole ledger instead of stopping at the first 50', async () => {
    renderPage();
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
    expect(get).toHaveBeenLastCalledWith('/operations/moves', { params: expect.objectContaining({ page: 2 }) });
  });

  it('goes back to page 1 when the filter changes', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 3');
    await userEvent.selectOptions(screen.getByRole('combobox'), 'DELIVERY');
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
  });
});
