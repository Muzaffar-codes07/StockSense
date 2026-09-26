// Mirrors backend/src/inventory/stock-row.ts. `type` (not interface) so rows
// satisfy the shared Table's Record<string, unknown> constraint.
export type StockStatus = 'OK' | 'LOW' | 'OUT';

export type StockRow = {
  id: string;
  name: string;
  sku: string;
  uom: string;
  unitCost: number;
  categoryId: string | null;
  categoryName: string | null;
  onHand: number;
  reserved: number;
  freeToUse: number;
  incoming: number;
  forecast: number;
  minQty: number | null;
  maxQty: number | null;
  status: StockStatus;
};

export type Paginated<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type StockFilters = {
  search?: string;
  categoryId?: string;
  status?: StockStatus;
  page?: number;
  pageSize?: number;
};

export type LocationStock = {
  locationId: string;
  locationName: string;
  warehouseName: string;
  qty: number;
};

export type LocationOption = {
  id: string;
  name: string;
  type: string;
  warehouseName: string;
};

export type StockKpis = {
  totalProductsInStock: number;
  lowStock: number;
  outOfStock: number;
  stockValue: number;
};
