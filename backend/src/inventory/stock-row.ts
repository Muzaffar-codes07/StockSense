export type StockStatus = 'OK' | 'LOW' | 'OUT';
export const STOCK_STATUSES: StockStatus[] = ['OK', 'LOW', 'OUT'];

/** One active product with its derived stock figures. */
export interface StockRow {
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
  /** On open (WAITING/READY) receipts, not yet received. */
  incoming: number;
  /** onHand + incoming − reserved: expected stock once open documents are done. */
  forecast: number;
  /** Reorder suggestion: up to maxQty (or minQty) once forecast <= minQty; 0 otherwise. */
  suggestedQty: number;
  minQty: number | null;
  maxQty: number | null;
  status: StockStatus;
}

export interface StockFilter {
  search?: string;
  categoryId?: string;
  statuses?: StockStatus[];
  skip?: number;
  take?: number;
}

export interface LocationStock {
  locationId: string;
  locationName: string;
  warehouseName: string;
  qty: number;
}

/** One open (WAITING/READY) document's quantity of a product. */
export interface OpenDocLine {
  docId: string;
  /** Same format as the Operations page: DEL-/REC- + first 8 id chars. */
  reference: string;
  partnerName: string | null;
  status: string;
  qty: number;
  createdAt: Date;
}

/** Every part behind a product's free-to-use and forecast figures. */
export interface StockBreakdown {
  productId: string;
  name: string;
  sku: string;
  uom: string;
  onHand: number;
  reserved: number;
  freeToUse: number;
  incoming: number;
  forecast: number;
  locations: LocationStock[];
  reservedBy: OpenDocLine[];
  incomingFrom: OpenDocLine[];
}

export interface LocationOption {
  id: string;
  name: string;
  type: string;
  warehouseName: string;
}

export interface StockKpis {
  totalProductsInStock: number;
  lowStock: number;
  outOfStock: number;
  stockValue: number;
}
