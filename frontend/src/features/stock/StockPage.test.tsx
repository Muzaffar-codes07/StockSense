import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { StockPage } from './StockPage';
import type { StockRow } from './types';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
const get = vi.mocked(api.get);

const row = (over: Partial<StockRow>): StockRow => ({
  id: 'x',
  name: 'X',
  sku: 'X-1',
  uom: 'l',
  unitCost: 8,
  categoryId: null,
  categoryName: null,
  onHand: 0,
  reserved: 0,
  freeToUse: 0,
  incoming: 0,
  forecast: 0,
  minQty: null,
  maxQty: null,
  status: 'OUT',
  ...over,
});

const varnish = row({ id: 'v', name: 'Wood Varnish 1L', incoming: 60, forecast: 60 });
const steel = row({
  id: 's',
  name: 'Steel Rods',
  uom: 'kg',
  onHand: 77,
  reserved: 10,
  freeToUse: 67,
  forecast: 67,
  status: 'OK',
});

function renderPage() {
  get.mockImplementation(async (url: string) => {
    if (url === '/stock') return { data: { data: [varnish, steel], page: 1, pageSize: 20, total: 2, totalPages: 1 } };
    if (url === '/stock/alerts') return { data: [varnish] };
    if (url === '/categories') return { data: [] };
    throw new Error(`404 ${url}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <StockPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cellsOf = async (name: string) => {
  const r = (await screen.findByText(name)).closest('tr')!;
  return within(r);
};

describe('StockPage forecast column', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('shows a Forecast column header', async () => {
    renderPage();
    expect(await screen.findByRole('columnheader', { name: 'Forecast' })).toBeInTheDocument();
  });

  it('shows what an OUT product will have once open receipts arrive', async () => {
    renderPage();
    const cells = await cellsOf('Wood Varnish 1L');
    expect(cells.getByText('60 l')).toBeInTheDocument();
    expect(cells.getByText('+60 incoming')).toBeInTheDocument();
  });

  it('explains the forecast on hover and shows no incoming hint when nothing is due', async () => {
    renderPage();
    const cells = await cellsOf('Steel Rods');
    expect(cells.getByTitle('77 on hand + 0 incoming − 10 reserved')).toHaveTextContent('67 kg');
    expect(cells.queryByText(/incoming$/)).not.toBeInTheDocument();
  });
});
