import type { LocationStock } from '@/features/stock/types';

// Mirrors backend UOMS in backend/src/products/dto/product.dto.ts.
export const UOMS = ['unit', 'kg', 'g', 'l', 'ml', 'm', 'box'] as const;
export type Uom = (typeof UOMS)[number];

/** Exact message the API returns for a duplicate SKU (products.service.ts). */
export const SKU_TAKEN = 'SKU already exists';

export type Category = { id: string; name: string; productCount: number };

export type ReorderRule = { minQty: number; maxQty: number | null };

export type ProductDetail = {
  id: string;
  name: string;
  sku: string;
  uom: string;
  unitCost: number;
  isActive: boolean;
  category: { id: string; name: string } | null;
  reorderRule: ReorderRule | null;
  locations: LocationStock[];
  createdAt: string;
  updatedAt: string;
};

export type ProductInput = {
  name: string;
  sku: string;
  categoryId: string | null;
  uom: string;
  unitCost: number;
  initialStock?: { qty: number; locationId?: string };
};
