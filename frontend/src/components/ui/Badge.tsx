import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { DOC_STATUS, MOVE_TYPE, STOCK_STATUS, toneClasses, type Tone } from '@/lib/status';
import type { DocStatus, MoveType } from '@/lib/operations';
import type { StockStatus } from '@/features/stock/types';

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
  title?: string;
}

/** Soft, tinted status pill. Colour is never the only signal — always a label. */
export function Badge({ tone = 'neutral', children, dot = true, className, title }: BadgeProps) {
  const t = toneClasses[tone];
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12px] font-medium leading-4',
        t.badge,
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} aria-hidden />}
      {children}
    </span>
  );
}

export function DocStatusBadge({ status }: { status: DocStatus }) {
  const s = DOC_STATUS[status] ?? DOC_STATUS.DRAFT;
  return (
    <Badge tone={s.tone} title={s.hint}>
      {s.label}
    </Badge>
  );
}

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const s = STOCK_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** Restrained move-type label: icon + word, one neutral surface. */
export function MoveTypeBadge({ type }: { type: MoveType }) {
  const m = MOVE_TYPE[type] ?? MOVE_TYPE.RECEIPT;
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-canvas px-2.5 py-[3px] text-[12px] font-medium text-chocolate ring-1 ring-inset ring-sienna/[0.06]">
      <Icon className="h-3.5 w-3.5 text-moonrock" aria-hidden />
      {m.label}
    </span>
  );
}
