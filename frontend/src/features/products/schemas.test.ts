import { describe, expect, it } from 'vitest';
import { productSchema, reorderRuleSchema, toProductInput } from './schemas';

const valid = {
  name: 'Steel Rod',
  sku: 'STL-01',
  categoryId: '',
  uom: 'unit',
  unitCost: '12.50',
  initialQty: '',
  initialLocationId: '',
};

const errorsFor = (values: Record<string, unknown>) => {
  const r = productSchema.safeParse(values);
  return r.success ? {} : r.error.flatten().fieldErrors;
};

describe('productSchema (mirrors the backend DTO)', () => {
  it('accepts a valid product and coerces numbers', () => {
    const r = productSchema.parse(valid);
    expect(r.unitCost).toBe(12.5);
    expect(r.initialQty).toBeUndefined();
  });

  it.each(['', ' ', '-STL', 'has space', 'x'.repeat(33), 'bad/char'])('rejects SKU %j', (sku) => {
    expect(errorsFor({ ...valid, sku }).sku).toBeDefined();
  });

  it('rejects negative cost, 3-decimal cost and 4-decimal quantity', () => {
    expect(errorsFor({ ...valid, unitCost: '-1' }).unitCost).toEqual(['Unit cost cannot be negative']);
    expect(errorsFor({ ...valid, unitCost: '1.005' }).unitCost).toEqual(['At most 2 decimals']);
    expect(errorsFor({ ...valid, initialQty: '1.0005' }).initialQty).toEqual(['At most 3 decimals']);
  });

  it('requires a name', () => {
    expect(errorsFor({ ...valid, name: '   ' }).name).toEqual(['Name is required']);
  });
});

describe('toProductInput', () => {
  const parsed = (over: Record<string, unknown> = {}) => productSchema.parse({ ...valid, ...over });

  it('sends initial stock only for a new product with qty > 0', () => {
    expect(toProductInput(parsed({ initialQty: '5', initialLocationId: 'loc' }), true).initialStock).toEqual({
      qty: 5,
      locationId: 'loc',
    });
    expect(toProductInput(parsed({ initialQty: '5' }), false).initialStock).toBeUndefined();
    expect(toProductInput(parsed({ initialQty: '0' }), true).initialStock).toBeUndefined();
  });

  it('omits the location so the server picks the default, and maps blank category to null', () => {
    const input = toProductInput(parsed({ initialQty: '5' }), true);
    expect(input.initialStock).toEqual({ qty: 5 });
    expect(input.categoryId).toBeNull();
  });
});

describe('reorderRuleSchema', () => {
  it('rejects a maximum below the minimum', () => {
    const r = reorderRuleSchema.safeParse({ minQty: '10', maxQty: '5' });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.flatten().fieldErrors.maxQty).toEqual(['Maximum must be at least the minimum']);
  });

  it('allows a blank maximum', () => {
    expect(reorderRuleSchema.parse({ minQty: '10', maxQty: '' })).toEqual({ minQty: 10, maxQty: undefined });
  });
});
