import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type { DocStatus, MoveType } from './operations';
import type { StockStatus } from '@/features/stock/types';

/**
 * The single status system. Badges, chips, charts and filters all read from
 * here — no component invents its own status colours.
 */
export type Tone = 'neutral' | 'warning' | 'info' | 'success' | 'danger' | 'brand';

export const toneClasses: Record<Tone, { badge: string; dot: string }> = {
  neutral: { badge: 'bg-dove/25 text-chocolate', dot: 'bg-moonrock' },
  warning: { badge: 'bg-warning/[0.13] text-warning-fg', dot: 'bg-warning' },
  info: { badge: 'bg-info/[0.12] text-info-fg', dot: 'bg-info' },
  success: { badge: 'bg-success/[0.12] text-success-fg', dot: 'bg-success' },
  danger: { badge: 'bg-danger/[0.10] text-danger-fg', dot: 'bg-danger' },
  brand: { badge: 'bg-sienna/[0.08] text-sienna', dot: 'bg-sienna' },
};

export const DOC_STATUS: Record<DocStatus, { label: string; tone: Tone; hint: string }> = {
  DRAFT: { label: 'Draft', tone: 'neutral', hint: 'Being prepared — not counted anywhere yet' },
  WAITING: { label: 'Waiting', tone: 'warning', hint: 'Confirmed, waiting on stock or goods' },
  READY: { label: 'Ready', tone: 'info', hint: 'Ready to validate' },
  DONE: { label: 'Done', tone: 'success', hint: 'Validated and posted to the stock ledger' },
  CANCELED: { label: 'Canceled', tone: 'danger', hint: 'Canceled — no stock moved' },
};

export const DOC_STATUS_ORDER: DocStatus[] = ['DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED'];

/** Documents that still need someone to act on them. */
export const OPEN_STATUSES: DocStatus[] = ['DRAFT', 'WAITING', 'READY'];

export const STOCK_STATUS: Record<StockStatus, { label: string; tone: Tone }> = {
  OK: { label: 'In stock', tone: 'success' },
  LOW: { label: 'Low stock', tone: 'warning' },
  OUT: { label: 'Out of stock', tone: 'danger' },
};

export const MOVE_TYPE: Record<
  MoveType,
  { label: string; short: string; icon: LucideIcon; tone: Tone; docPath: string }
> = {
  RECEIPT: { label: 'Receipt', short: 'REC', icon: ArrowDownLeft, tone: 'success', docPath: '/operations/receipts' },
  DELIVERY: { label: 'Delivery', short: 'DEL', icon: ArrowUpRight, tone: 'danger', docPath: '/operations/deliveries' },
  INTERNAL: { label: 'Transfer', short: 'TRF', icon: ArrowLeftRight, tone: 'info', docPath: '/operations/transfers' },
  ADJUSTMENT: { label: 'Adjustment', short: 'ADJ', icon: SlidersHorizontal, tone: 'neutral', docPath: '/operations/adjustments' },
};

/** Human document reference from an id, e.g. REC-1A2B3C4D. */
export const docRef = (prefix: string, id: string) => `${prefix}-${id.slice(0, 8).toUpperCase()}`;

/** Chart series colours — derived from the brand palette, one cool accent. */
export const CHART = {
  onHand: 'rgb(var(--ss-sienna))',
  available: 'rgb(var(--ss-chocolate))',
  reserved: 'rgb(var(--ss-moonrock))',
  incoming: 'rgb(var(--ss-dove))',
  forecast: 'rgb(var(--ss-forecast))',
  accent: 'rgb(var(--ss-steel))',
  grid: 'rgb(57 18 20 / 0.06)',
  axis: 'rgb(var(--ss-ink-2))',
} as const;
