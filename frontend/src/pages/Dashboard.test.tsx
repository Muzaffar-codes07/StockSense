import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
const get = vi.mocked(api.get);

const stockKpis = { totalProductsInStock: 77, lowStock: 2, outOfStock: 1, stockValue: 1000 };

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const tile = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

describe('Dashboard KPIs', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('shows live operation counts from /operations/kpi-counts', async () => {
    get.mockImplementation(async (url: string) => {
      if (url === '/stock/kpis') return { data: stockKpis };
      if (url === '/operations/kpi-counts') {
        return { data: { pendingReceipts: 4, pendingDeliveries: 6, scheduledTransfers: 1 } };
      }
      throw new Error(`404 ${url}`);
    });
    renderDashboard();
    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(tile('Pending Receipts')).toBe('4');
    expect(tile('Pending Deliveries')).toBe('6');
    expect(tile('Internal Transfers')).toBe('1');
    expect(tile('Products in Stock')).toBe('77');
  });

  it('never shows made-up numbers when the API fails', async () => {
    get.mockRejectedValue(new Error('Network Error'));
    renderDashboard();
    expect(await screen.findByText(/couldn.t load/i)).toBeInTheDocument();
    expect(tile('Pending Receipts')).toBe('—');
    expect(tile('Pending Deliveries')).toBe('—');
    expect(tile('Internal Transfers')).toBe('—');
  });
});
