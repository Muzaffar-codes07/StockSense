import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateDeliveryModal } from './CreateDeliveryModal';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
const get = vi.mocked(api.get);

// Steel: 77 on hand, 10 already promised to another delivery -> 67 free to use.
beforeEach(() => {
  get.mockReset();
  get.mockImplementation(async (url: string) => {
    if (url === '/products') {
      return { data: { data: [{ id: 'steel', name: 'Steel Rods', sku: 'STEEL-001', uom: 'kg', onHand: 77, freeToUse: 67 }] } };
    }
    if (url === '/locations') return { data: [{ id: 'main', name: 'Main Store' }] };
    return { data: [] };
  });
});

const qtyInput = async () => (await screen.findAllByRole('spinbutton'))[0];

describe('CreateDeliveryModal stock warning (#12)', () => {
  it('marks a line asking for more than is free to use', async () => {
    render(<CreateDeliveryModal open onClose={vi.fn()} onSuccess={vi.fn()} />);
    await screen.findByRole('option', { name: 'Steel Rods (STEEL-001)' });
    await userEvent.clear(await qtyInput());
    await userEvent.type(await qtyInput(), '100');
    expect(await screen.findByText('Only 67 kg free to use')).toBeInTheDocument();
  });

  it('shows no warning when the quantity is available', async () => {
    render(<CreateDeliveryModal open onClose={vi.fn()} onSuccess={vi.fn()} />);
    await screen.findByRole('option', { name: 'Steel Rods (STEEL-001)' });
    await userEvent.clear(await qtyInput());
    await userEvent.type(await qtyInput(), '67');
    expect(screen.queryByText(/free to use/)).not.toBeInTheDocument();
  });
});
