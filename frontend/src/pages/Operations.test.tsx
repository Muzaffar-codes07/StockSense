import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Operations } from './Operations';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() } }));
const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

const loc = (id: string, name: string) => ({ id, name, type: 'STOCK', warehouseId: 'w' });
const transfer = {
  id: 't1234567-0000-4000-8000-000000000000',
  status: 'DRAFT',
  createdAt: '2026-09-26T08:00:00Z',
  lines: [
    {
      id: 'l1',
      productId: 'p1',
      qty: 5,
      product: { id: 'p1', name: 'Steel Rods', sku: 'STEEL-001' },
      fromLocationId: 'm',
      toLocationId: 'r',
      fromLocation: loc('m', 'Main Store'),
      toLocation: loc('r', 'Production Rack'),
    },
  ],
};

function renderOperations() {
  get.mockImplementation(async (url: string) => {
    if (url === '/operations/transfers') return { data: { data: [transfer], page: 1, pageSize: 20, total: 1, totalPages: 1 } };
    return { data: { data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 } };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Operations />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Operations page action errors (#12)', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('shows the server message when validating a transfer fails (e.g. not enough stock)', async () => {
    post.mockRejectedValue(new Error('Not enough stock for Steel Rods (STEEL-001): 3 available, 5 requested'));
    renderOperations();
    await userEvent.click(screen.getByRole('button', { name: /transfers/i }));
    await userEvent.click(await screen.findByRole('button', { name: /validate/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Not enough stock for Steel Rods (STEEL-001): 3 available, 5 requested',
    );
  });

  it('shows why a cancel was refused', async () => {
    post.mockRejectedValue(new Error('Transfer is already validated or canceled'));
    renderOperations();
    await userEvent.click(screen.getByRole('button', { name: /transfers/i }));
    await userEvent.click(await screen.findByTitle('Cancel Transfer'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Transfer is already validated or canceled');
  });
});
