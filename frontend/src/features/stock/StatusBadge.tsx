import type { StockStatus } from './types';

const styles: Record<StockStatus, string> = {
  OK: 'bg-emerald-50 text-emerald-700',
  LOW: 'bg-amber-50 text-amber-700',
  OUT: 'bg-red-50 text-red-700',
};

const labels: Record<StockStatus, string> = {
  OK: 'In stock',
  LOW: 'Low stock',
  OUT: 'Out of stock',
};

export const STATUS_OPTIONS = (['OK', 'LOW', 'OUT'] as StockStatus[]).map((s) => ({
  value: s,
  label: labels[s],
}));

export function StatusBadge({ status }: { status: StockStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
