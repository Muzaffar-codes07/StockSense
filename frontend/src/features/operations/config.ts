import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import {
  cancelAdjustment,
  cancelDelivery,
  cancelReceipt,
  cancelTransfer,
  getAdjustment,
  getAdjustments,
  getDeliveries,
  getDelivery,
  getReceipt,
  getReceipts,
  getTransfer,
  getTransfers,
  updateAdjustmentStatus,
  updateDeliveryStatus,
  updateReceiptStatus,
  updateTransferStatus,
  validateAdjustment,
  validateDelivery,
  validateReceipt,
  validateTransfer,
  type Adjustment,
  type Delivery,
  type DocStatus,
  type OperationFilterParams,
  type PaginatedResponse,
  type Receipt,
  type Transfer,
} from '@/lib/operations';

export type OperationKind = 'receipt' | 'delivery' | 'transfer' | 'adjustment';
export type AnyDoc = Receipt | Delivery | Transfer | Adjustment;

export interface OperationConfig {
  kind: OperationKind;
  label: string;
  plural: string;
  prefix: string;
  path: string;
  icon: LucideIcon;
  /** One line that explains what the document does to stock. */
  purpose: string;
  effect: string;
  partnerType?: 'SUPPLIER' | 'CUSTOMER';
  partnerLabel?: string;
  /** Receipts/deliveries pick their location when validated. */
  validateNeedsLocation: boolean;
  locationLabel?: string;
  list: (p?: OperationFilterParams) => Promise<PaginatedResponse<AnyDoc>>;
  get: (id: string) => Promise<AnyDoc>;
  setStatus: (id: string, s: DocStatus) => Promise<unknown>;
  validate: (id: string, locationId?: string) => Promise<unknown>;
  cancel: (id: string) => Promise<unknown>;
}

export const OPERATIONS: Record<OperationKind, OperationConfig> = {
  receipt: {
    kind: 'receipt',
    label: 'Receipt',
    plural: 'Receipts',
    prefix: 'REC',
    path: '/operations/receipts',
    icon: ArrowDownLeft,
    purpose: 'Incoming goods from suppliers',
    effect: 'Validating adds the received quantities to the destination location.',
    partnerType: 'SUPPLIER',
    partnerLabel: 'Supplier',
    validateNeedsLocation: true,
    locationLabel: 'Receive into',
    list: getReceipts as OperationConfig['list'],
    get: getReceipt,
    setStatus: updateReceiptStatus,
    validate: (id, loc) => validateReceipt(id, loc ?? ''),
    cancel: cancelReceipt,
  },
  delivery: {
    kind: 'delivery',
    label: 'Delivery',
    plural: 'Deliveries',
    prefix: 'DEL',
    path: '/operations/deliveries',
    icon: ArrowUpRight,
    purpose: 'Outgoing orders to customers',
    effect: 'Validating removes the quantities from the source location. Stock can never go negative.',
    partnerType: 'CUSTOMER',
    partnerLabel: 'Customer',
    validateNeedsLocation: true,
    locationLabel: 'Ship from',
    list: getDeliveries as OperationConfig['list'],
    get: getDelivery,
    setStatus: updateDeliveryStatus,
    validate: (id, loc) => validateDelivery(id, loc ?? ''),
    cancel: cancelDelivery,
  },
  transfer: {
    kind: 'transfer',
    label: 'Transfer',
    plural: 'Transfers',
    prefix: 'TRF',
    path: '/operations/transfers',
    icon: ArrowLeftRight,
    purpose: 'Moves between locations',
    effect: 'Validating moves stock between locations. Total company stock stays the same.',
    validateNeedsLocation: false,
    list: getTransfers as OperationConfig['list'],
    get: getTransfer,
    setStatus: updateTransferStatus,
    validate: (id) => validateTransfer(id),
    cancel: cancelTransfer,
  },
  adjustment: {
    kind: 'adjustment',
    label: 'Adjustment',
    plural: 'Adjustments',
    prefix: 'ADJ',
    path: '/operations/adjustments',
    icon: SlidersHorizontal,
    purpose: 'Reconcile physical counts',
    effect: 'Validating posts the difference between recorded and counted stock to the ledger.',
    validateNeedsLocation: false,
    list: getAdjustments as OperationConfig['list'],
    get: getAdjustment,
    setStatus: updateAdjustmentStatus,
    validate: (id) => validateAdjustment(id),
    cancel: cancelAdjustment,
  },
};

export const OPERATION_KINDS: OperationKind[] = ['receipt', 'delivery', 'transfer', 'adjustment'];

/** Readable document reference, e.g. REC-1A2B3C4D. */
export const refOf = (kind: OperationKind, id: string) => `${OPERATIONS[kind].prefix}-${id.slice(0, 8).toUpperCase()}`;

/** Map a StockMove.docType ("receipt", "delivery", "transfer", "adjustment", "initial") to a kind. */
export const kindOfDocType = (docType?: string | null): OperationKind | null =>
  docType && docType in OPERATIONS ? (docType as OperationKind) : null;
