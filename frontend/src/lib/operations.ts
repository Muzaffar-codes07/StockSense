import { api } from './api';

export type DocStatus = 'DRAFT' | 'WAITING' | 'READY' | 'DONE' | 'CANCELED';
export type MoveType = 'RECEIPT' | 'DELIVERY' | 'INTERNAL' | 'ADJUSTMENT';

export interface Partner {
  id: string;
  name: string;
  type: 'SUPPLIER' | 'CUSTOMER';
}

export interface LocationItem {
  id: string;
  name: string;
  warehouseId: string;
  type: string;
  warehouse?: { id: string; name: string };
}

export interface ProductItem {
  id: string;
  name: string;
  sku: string;
  uom: string;
  unitCost?: number;
  category?: { id: string; name: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ReceiptLine {
  id: string;
  productId: string;
  qty: number | string;
  product: ProductItem;
}

export interface Receipt {
  id: string;
  partnerId?: string | null;
  partner?: Partner | null;
  status: DocStatus;
  createdAt: string;
  validatedAt?: string | null;
  lines: ReceiptLine[];
}

export interface DeliveryLine {
  id: string;
  productId: string;
  qty: number | string;
  product: ProductItem;
}

export interface Delivery {
  id: string;
  partnerId?: string | null;
  partner?: Partner | null;
  status: DocStatus;
  createdAt: string;
  validatedAt?: string | null;
  lines: DeliveryLine[];
}

export interface TransferLine {
  id: string;
  productId: string;
  qty: number | string;
  product: ProductItem;
  fromLocationId: string;
  fromLocation: LocationItem;
  toLocationId: string;
  toLocation: LocationItem;
}

export interface Transfer {
  id: string;
  status: DocStatus;
  createdAt: string;
  validatedAt?: string | null;
  lines: TransferLine[];
}

export interface AdjustmentLine {
  id: string;
  productId: string;
  product: ProductItem;
  countedQty: number | string;
  recordedQty: number | string;
  diff: number | string;
}

export interface Adjustment {
  id: string;
  locationId: string;
  location: LocationItem;
  status: DocStatus;
  createdAt: string;
  validatedAt?: string | null;
  lines: AdjustmentLine[];
}

export interface StockMove {
  id: string;
  productId: string;
  product: ProductItem;
  fromLocationId?: string | null;
  fromLocation?: LocationItem | null;
  toLocationId?: string | null;
  toLocation?: LocationItem | null;
  qty: number | string;
  moveType: MoveType;
  docType?: string | null;
  docId?: string | null;
  doneAt: string;
  createdAt: string;
  createdBy?: { id: string; name: string; email: string } | null;
}

export interface OperationsKpiCounts {
  pendingReceipts: number;
  pendingDeliveries: number;
  scheduledTransfers: number;
}

export interface OperationFilterParams {
  page?: number;
  pageSize?: number;
  status?: DocStatus | '';
  partnerId?: string;
  locationId?: string;
  search?: string;
}

export interface MoveHistoryFilterParams {
  page?: number;
  pageSize?: number;
  productId?: string;
  locationId?: string;
  moveType?: MoveType | '';
  docType?: string;
  docId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// ---------------------------------------------------------------------------
// Receipts API
// ---------------------------------------------------------------------------
export async function getReceipts(params?: OperationFilterParams): Promise<PaginatedResponse<Receipt>> {
  const res = await api.get('/operations/receipts', { params });
  return res.data;
}

export async function getReceipt(id: string): Promise<Receipt> {
  const res = await api.get(`/operations/receipts/${id}`);
  return res.data;
}

export async function createReceipt(payload: {
  partnerId?: string;
  destinationLocationId?: string;
  lines: { productId: string; qty: number }[];
}): Promise<Receipt> {
  const res = await api.post('/operations/receipts', payload);
  return res.data;
}

export async function updateReceiptStatus(id: string, status: DocStatus): Promise<Receipt> {
  const res = await api.put(`/operations/receipts/${id}/status`, { status });
  return res.data;
}

export async function validateReceipt(id: string, locationId: string): Promise<Receipt> {
  const res = await api.post(`/operations/receipts/${id}/validate`, { locationId });
  return res.data;
}

export async function cancelReceipt(id: string): Promise<Receipt> {
  const res = await api.post(`/operations/receipts/${id}/cancel`);
  return res.data;
}

// ---------------------------------------------------------------------------
// Deliveries API
// ---------------------------------------------------------------------------
export async function getDeliveries(params?: OperationFilterParams): Promise<PaginatedResponse<Delivery>> {
  const res = await api.get('/operations/deliveries', { params });
  return res.data;
}

export async function getDelivery(id: string): Promise<Delivery> {
  const res = await api.get(`/operations/deliveries/${id}`);
  return res.data;
}

export async function createDelivery(payload: {
  partnerId?: string;
  sourceLocationId?: string;
  lines: { productId: string; qty: number }[];
}): Promise<Delivery> {
  const res = await api.post('/operations/deliveries', payload);
  return res.data;
}

export async function updateDeliveryStatus(id: string, status: DocStatus): Promise<Delivery> {
  const res = await api.put(`/operations/deliveries/${id}/status`, { status });
  return res.data;
}

export async function validateDelivery(id: string, locationId: string): Promise<Delivery> {
  const res = await api.post(`/operations/deliveries/${id}/validate`, { locationId });
  return res.data;
}

export async function cancelDelivery(id: string): Promise<Delivery> {
  const res = await api.post(`/operations/deliveries/${id}/cancel`);
  return res.data;
}

// ---------------------------------------------------------------------------
// Transfers API
// ---------------------------------------------------------------------------
export async function getTransfers(params?: OperationFilterParams): Promise<PaginatedResponse<Transfer>> {
  const res = await api.get('/operations/transfers', { params });
  return res.data;
}

export async function getTransfer(id: string): Promise<Transfer> {
  const res = await api.get(`/operations/transfers/${id}`);
  return res.data;
}

export async function createTransfer(payload: {
  lines: { productId: string; qty: number; fromLocationId: string; toLocationId: string }[];
}): Promise<Transfer> {
  const res = await api.post('/operations/transfers', payload);
  return res.data;
}

export async function updateTransferStatus(id: string, status: DocStatus): Promise<Transfer> {
  const res = await api.put(`/operations/transfers/${id}/status`, { status });
  return res.data;
}

export async function validateTransfer(id: string): Promise<Transfer> {
  const res = await api.post(`/operations/transfers/${id}/validate`);
  return res.data;
}

export async function cancelTransfer(id: string): Promise<Transfer> {
  const res = await api.post(`/operations/transfers/${id}/cancel`);
  return res.data;
}

// ---------------------------------------------------------------------------
// Adjustments API
// ---------------------------------------------------------------------------
export async function getAdjustments(params?: OperationFilterParams): Promise<PaginatedResponse<Adjustment>> {
  const res = await api.get('/operations/adjustments', { params });
  return res.data;
}

export async function getAdjustment(id: string): Promise<Adjustment> {
  const res = await api.get(`/operations/adjustments/${id}`);
  return res.data;
}

export async function createAdjustment(payload: {
  locationId: string;
  lines: { productId: string; countedQty: number; recordedQty?: number }[];
}): Promise<Adjustment> {
  const res = await api.post('/operations/adjustments', payload);
  return res.data;
}

export async function updateAdjustmentStatus(id: string, status: DocStatus): Promise<Adjustment> {
  const res = await api.put(`/operations/adjustments/${id}/status`, { status });
  return res.data;
}

export async function validateAdjustment(id: string): Promise<Adjustment> {
  const res = await api.post(`/operations/adjustments/${id}/validate`);
  return res.data;
}

export async function cancelAdjustment(id: string): Promise<Adjustment> {
  const res = await api.post(`/operations/adjustments/${id}/cancel`);
  return res.data;
}

// ---------------------------------------------------------------------------
// Move History & KPI API
// ---------------------------------------------------------------------------
export async function getMoveHistory(params?: MoveHistoryFilterParams): Promise<PaginatedResponse<StockMove>> {
  const res = await api.get('/operations/moves', { params });
  return res.data;
}

export async function getOperationsKpiCounts(): Promise<OperationsKpiCounts> {
  const res = await api.get('/operations/kpi-counts');
  return res.data;
}

// ---------------------------------------------------------------------------
// Supporting Resources (Partners, Locations, Products)
// ---------------------------------------------------------------------------
export async function getPartners(type?: 'SUPPLIER' | 'CUSTOMER'): Promise<Partner[]> {
  const res = await api.get('/partners', { params: type ? { type } : undefined });
  return res.data;
}

export async function getLocations(warehouseId?: string): Promise<LocationItem[]> {
  const res = await api.get('/locations', { params: warehouseId ? { warehouseId } : undefined });
  return res.data;
}

export async function getProductsList(): Promise<ProductItem[]> {
  const res = await api.get('/products', { params: { pageSize: 100 } });
  // Products endpoint returns Paginated { data: Product[] }
  return res.data?.data ?? res.data ?? [];
}

export interface ProductLocationStock {
  locationId: string;
  locationName: string;
  warehouseName?: string;
  qty: number;
}

// Current on-hand of a product broken down by location (Role 3's stock endpoint).
export async function getProductStockByLocation(productId: string): Promise<ProductLocationStock[]> {
  const res = await api.get(`/stock/${productId}/locations`);
  return res.data ?? [];
}
