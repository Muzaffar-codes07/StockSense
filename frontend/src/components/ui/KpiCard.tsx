import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card, type CardTone } from './Card';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Colours the small context line, never the metric itself. */
  accent?: 'default' | 'warning' | 'danger' | 'success';
  tone?: CardTone;
  icon?: LucideIcon;
  /** One short line of real context, e.g. "2 out of stock". */
  context?: ReactNode;
  /** Makes the whole card a link to the list behind the number. */
  to?: string;
  loading?: boolean;
}

const accentText = {
  default: 'text-ink-2',
  warning: 'text-warning-fg',
  danger: 'text-danger-fg',
  success: 'text-success-fg',
};

// Operational KPI tile. DOM order is label → value (screen readers read "Pending
// receipts, 4"); flex-col-reverse puts the metric visually on top, like the
// reference's asset cards.
export function KpiCard({ label, value, accent = 'default', tone = 'surface', icon: Icon, context, to, loading }: KpiCardProps) {
  const dark = tone === 'sienna' || tone === 'raspberry';
  const body = (
    <Card
      tone={tone}
      size="md"
      interactive={Boolean(to)}
      className="flex h-full min-h-[168px] flex-col justify-between gap-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col-reverse gap-1">
          <p className={cn('text-[13px] font-medium', dark ? 'text-ondark/70' : 'text-ink-2')}>{label}</p>
          <p className={cn('tabular text-kpi', dark ? 'text-white' : 'text-ink', loading && 'animate-pulse text-ink-3')}>
            {value}
          </p>
        </div>
        {to && (
          <span
            aria-hidden
            className={cn(
              'grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors',
              dark ? 'bg-white/10 text-ondark' : 'bg-white/70 text-ink-2 group-hover:text-sienna',
            )}
          >
            <ArrowUpRight className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        {Icon && (
          <span
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-[12px] shadow-[0_2px_8px_rgb(22_15_12/0.08)]',
              dark ? 'bg-white/10 text-ondark' : 'bg-surface text-raspberry',
            )}
            aria-hidden
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
        )}
        {context && (
          <span className={cn('text-right text-[12px] font-medium leading-4', dark ? 'text-ondark/70' : accentText[accent])}>
            {context}
          </span>
        )}
      </div>
    </Card>
  );
  if (!to) return body;
  return (
    <Link to={to} className="group block h-full rounded-card-sm focus-visible:outline-offset-4" aria-label={`${label}: open list`}>
      {body}
    </Link>
  );
}
