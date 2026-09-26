import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateAdjustmentModal } from './CreateAdjustmentModal';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

// Steel: 77 at Main Store, 5 at Shelf B. Bolts: nothing anywhere.
const stockByProduct: Record<string, unknown[]> = {
  steel: [
    { locationId: 'main', locationName: 'Main Store', warehouseName: 'WH', qty: 77 },
    { locationId: 'shelf', locationName: 'Shelf B', warehouseName: 'WH', qty: 5 },
  ],
  bolts: [],
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockImplementation(async (url: string) => {
    if (url === '/locations') {
      return { data: [{ id: 'main', name: 'Main Store' }, { id: 'shelf', name: 'Shelf B' }] };
    }
    if (url === '/products') {
      return {
        data: {
          data: [
            { id: 'steel', name: 'Steel', sku: 'STL' },
            { id: 'bolts', name: 'Bolts', sku: 'BLT' },
          ],
        },
      };
    }
    const m = url.match(/^\/stock\/([^/]+)\/locations$/);
    if (m) return { data: stockByProduct[m[1]] };
    throw new Error(`Request failed with status code 404 (${url})`);
  });
  post.mockResolvedValue({ data: { id: 'adj-1' } });
});

const renderModal = () =>
  render(<CreateAdjustmentModal open onClose={vi.fn()} onSuccess={vi.fn()} />);

const recordedInput = () => screen.getAllByRole('spinbutton')[0] as HTMLInputElement;
const countedInput = () => screen.getAllByRole('spinbutton')[1] as HTMLInputElement;

describe('CreateAdjustmentModal recorded quantity', () => {
  it('shows the ledger on-hand for the selected product and location', async () => {
    renderModal();
    await waitFor(() => expect(recordedInput().value).toBe('77'));
    expect(get).toHaveBeenCalledWith('/stock/steel/locations');
    expect(get).not.toHaveBeenCalledWith('/inventory', expect.anything());
  });

  it('follows the location: 5 at Shelf B', async () => {
    renderModal();
    await waitFor(() => expect(recordedInput().value).toBe('77'));
    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], 'shelf');
    await waitFor(() => expect(recordedInput().value).toBe('5'));
  });

  it('shows 0 for a product with no stock at the location', async () => {
    renderModal();
    await waitFor(() => expect(recordedInput().value).toBe('77'));
    await userEvent.selectOptions(screen.getAllByRole('combobox')[1], 'bolts');
    await waitFor(() => expect(recordedInput().value).toBe('0'));
  });

  it('is read-only: the recorded quantity comes from the ledger, not the user', async () => {
    renderModal();
    await waitFor(() => expect(recordedInput().value).toBe('77'));
    expect(recordedInput()).toHaveAttribute('readonly');
  });

  it('lets the server compute recorded qty and diff, so a stale screen cannot skew stock', async () => {
    renderModal();
    await waitFor(() => expect(recordedInput().value).toBe('77'));
    await userEvent.clear(countedInput());
    await userEvent.type(countedInput(), '70');
    await userEvent.click(screen.getByRole('button', { name: /create adjustment/i }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith('/operations/adjustments', {
      locationId: 'main',
      lines: [{ productId: 'steel', countedQty: 70 }],
    });
  });
});
