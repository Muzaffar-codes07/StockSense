import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { stockApi } from './api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
const post = vi.mocked(api.post);

describe('stockApi.adjustStock', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('creates an adjustment without recordedQty, then validates it', async () => {
    post.mockResolvedValueOnce({ data: { id: 'adj-9' } }).mockResolvedValueOnce({ data: { status: 'DONE' } });
    await expect(stockApi.adjustStock({ locationId: 'main', productId: 'steel', countedQty: 70 })).resolves.toEqual({
      status: 'DONE',
    });
    expect(post.mock.calls).toEqual([
      ['/operations/adjustments', { locationId: 'main', lines: [{ productId: 'steel', countedQty: 70 }] }],
      ['/operations/adjustments/adj-9/validate'],
    ]);
  });

  it('does not validate when creating the adjustment fails', async () => {
    post.mockRejectedValueOnce(new Error('Location not found'));
    await expect(
      stockApi.adjustStock({ locationId: 'x', productId: 'steel', countedQty: 1 }),
    ).rejects.toThrow('Location not found');
    expect(post).toHaveBeenCalledTimes(1);
  });
});
