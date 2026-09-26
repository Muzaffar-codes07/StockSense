import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  suggestedQty: 0,
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

const screws = row({ id: "sc", name: "Screws M6", uom: "box", onHand: 12, forecast: 12, minQty: 20, maxQty: 100, suggestedQty: 88, status: "LOW" });

const steelBreakdown = {
  productId: 's',
  name: 'Steel Rods',
  sku: 'STEEL-001',
  uom: 'kg',
  onHand: 77,
  reserved: 10,
  freeToUse: 67,
  incoming: 0,
  forecast: 67,
  locations: [
    { locationId: 'm', locationName: 'Main Store', warehouseName: 'Main Warehouse', qty: 67 },
    { locationId: 'r', locationName: 'Production Rack', warehouseName: 'Main Warehouse', qty: 10 },
  ],
  reservedBy: [
    { docId: 'd1', reference: 'DEL-1A2B3C4D', partnerName: 'Beta Retailers', status: 'WAITING', qty: 10, createdAt: '' },
  ],
  incomingFrom: [],
};

function renderPage() {
  get.mockImplementation(async (url: string) => {
    if (url === '/stock') return { data: { data: [varnish, steel, screws], page: 1, pageSize: 20, total: 3, totalPages: 1 } };
    if (url === '/stock/alerts') return { data: [varnish] };
    if (url === '/categories') return { data: [] };
    if (url === '/stock/s/breakdown') return { data: steelBreakdown };
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

  it("suggests how much to reorder when the forecast falls to the minimum (audit #13)", async () => {
    renderPage();
    const cells = await cellsOf("Screws M6");
    expect(cells.getByText("Reorder 88 box")).toHaveAttribute("title", "Forecast 12 is at or under the minimum 20: order up to 100");
    expect((await cellsOf("Steel Rods")).queryByText(/Reorder/)).not.toBeInTheDocument();
  });

  it('accepts a lowercase ?status= in the URL (e.g. a hand-typed or shared link)', async () => {
    get.mockImplementation(async (url: string) => {
      if (url === '/stock') return { data: { data: [varnish], page: 1, pageSize: 20, total: 1, totalPages: 1 } };
      return { data: [] };
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/stock?status=low']}>
          <StockPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('Wood Varnish 1L');
    expect(get).toHaveBeenCalledWith('/stock', { params: expect.objectContaining({ status: 'LOW' }) });
    expect(screen.getByLabelText('Stock status')).toHaveValue('LOW');
  });

  describe('free-to-use breakdown', () => {
    it('opens a worked sum when the free-to-use value is clicked', async () => {
      renderPage();
      const cells = await cellsOf('Steel Rods');
      await userEvent.click(cells.getByRole('button', { name: /67 kg/ }));

      const dialog = await screen.findByRole('dialog', { name: /Steel Rods/ });
      const inDialog = within(dialog);
      expect(await inDialog.findByText('Main Store')).toBeInTheDocument();
      expect(inDialog.getByText('Production Rack')).toBeInTheDocument();
      expect(inDialog.getByText('DEL-1A2B3C4D')).toBeInTheDocument();
      expect(inDialog.getByText(/Beta Retailers/)).toBeInTheDocument();
      expect(inDialog.getByTestId('total-onHand')).toHaveTextContent('77 kg');
      expect(inDialog.getByTestId('total-reserved')).toHaveTextContent('10 kg');
      expect(inDialog.getByTestId('total-freeToUse')).toHaveTextContent('67 kg');
      expect(inDialog.getByTestId('total-forecast')).toHaveTextContent('67 kg');
      expect(inDialog.getByText(/No open receipts/)).toBeInTheDocument();
    });
  });
});
