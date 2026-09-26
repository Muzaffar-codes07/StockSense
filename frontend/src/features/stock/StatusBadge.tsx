import { StockStatusBadge } from '@/components/ui';
import { STOCK_STATUS } from '@/lib/status';
import type { StockStatus } from './types';

export const STATUS_OPTIONS = (['OK', 'LOW', 'OUT'] as StockStatus[]).map((s) => ({
  value: s,
  label: STOCK_STATUS[s].label,
}));

/** Kept for existing imports; the look lives in the shared badge system. */
export function StatusBadge({ status }: { status: StockStatus }) {
  return <StockStatusBadge status={status} />;
}
