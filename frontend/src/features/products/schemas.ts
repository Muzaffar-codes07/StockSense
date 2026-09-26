import { z } from 'zod';
import { UOMS, type ProductInput } from './types';

// Mirrors backend DTO rules so users see the same messages before submitting.
const maxDecimals = (places: number) => (n: number) =>
  Math.abs(n * 10 ** places - Math.round(n * 10 ** places)) < 1e-6;

const blankToUndefined = (v: unknown) =>
  v === '' || v === null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v;

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name must be at most 120 characters'),
  sku: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/, 'SKU must be 1-32 letters, digits, dot, dash or underscore'),
  categoryId: z.string(),
  uom: z.enum(UOMS),
  unitCost: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .min(0, 'Unit cost cannot be negative')
    .refine(maxDecimals(2), 'At most 2 decimals'),
  initialQty: z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ invalid_type_error: 'Enter a number' })
      .min(0, 'Quantity cannot be negative')
      .refine(maxDecimals(3), 'At most 3 decimals')
      .optional(),
  ),
  initialLocationId: z.string(),
});
export type ProductFormValues = z.infer<typeof productSchema>;

export function toProductInput(v: ProductFormValues, isNew: boolean): ProductInput {
  const input: ProductInput = {
    name: v.name,
    sku: v.sku,
    categoryId: v.categoryId || null,
    uom: v.uom,
    unitCost: v.unitCost,
  };
  if (isNew && v.initialQty && v.initialQty > 0) {
    input.initialStock = {
      qty: v.initialQty,
      ...(v.initialLocationId ? { locationId: v.initialLocationId } : {}),
    };
  }
  return input;
}

export const reorderRuleSchema = z
  .object({
    minQty: z.coerce
      .number({ invalid_type_error: 'Enter a number' })
      .min(0, 'Minimum cannot be negative')
      .refine(maxDecimals(3), 'At most 3 decimals'),
    maxQty: z.preprocess(
      blankToUndefined,
      z.coerce
        .number({ invalid_type_error: 'Enter a number' })
        .min(0, 'Maximum cannot be negative')
        .refine(maxDecimals(3), 'At most 3 decimals')
        .optional(),
    ),
  })
  .refine((v) => v.maxQty === undefined || v.maxQty >= v.minQty, {
    message: 'Maximum must be at least the minimum',
    path: ['maxQty'],
  });
export type ReorderRuleValues = z.infer<typeof reorderRuleSchema>;
