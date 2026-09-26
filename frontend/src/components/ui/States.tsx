import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, RotateCw, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-ink-2', className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Shimmering placeholder block that reserves layout space (no content jump). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative block overflow-hidden rounded-lg bg-dove/25',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent',
        className,
      )}
    />
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-14', className)}>
      {Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-canvas text-moonrock ring-1 ring-inset ring-sienna/[0.06]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      )}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

/** Friendly failure with an optional retry. Never a raw stack or status code alone. */
export function ErrorState({ title = 'Unavailable right now', message, onRetry, className, compact }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-12', className)}>
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-danger/10 text-danger-fg">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      {message && <p className="mt-1 max-w-sm text-[13px] text-ink-2">{friendlyError(message)}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry} icon={<RotateCw className="h-3.5 w-3.5" />}>
          Try again
        </Button>
      )}
    </div>
  );
}

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';

const noticeStyles: Record<NoticeTone, { box: string; icon: LucideIcon }> = {
  info: { box: 'bg-info/[0.08] text-info-fg ring-info/15', icon: Info },
  warning: { box: 'bg-warning/[0.10] text-warning-fg ring-warning/20', icon: AlertTriangle },
  danger: { box: 'bg-danger/[0.08] text-danger-fg ring-danger/15', icon: AlertTriangle },
  success: { box: 'bg-success/[0.09] text-success-fg ring-success/15', icon: CheckCircle2 },
};

/** Inline banner for form errors, confirmations and page-level warnings. */
export function Notice({
  tone = 'info',
  children,
  action,
  className,
}: {
  tone?: NoticeTone;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const s = noticeStyles[tone];
  const Icon = s.icon;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-[14px] px-4 py-3 text-[13px] ring-1 ring-inset', s.box, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {/* API errors arrive as strings; danger notices always show the readable form. */}
      <div className="min-w-0 flex-1 leading-5">{tone === 'danger' && typeof children === 'string' ? friendlyError(children) : children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Turn API/transport errors into something a warehouse user can act on.
 * Domain messages from the API (e.g. "Not enough stock for …") pass through.
 */
export function friendlyError(message: string): string {
  // postMove's guard: "Not enough stock for Steel Rods (STEEL-001): 7 available, 10 requested"
  const short = message.match(/Not enough stock for (.+?): ([\d.,]+) available, ([\d.,]+) requested/i);
  if (short) {
    return `Only ${short[2]} of ${short[1]} available at that location — ${short[3]} requested.`;
  }
  if (/network error|failed to fetch|ECONNREFUSED/i.test(message)) {
    return "Can't reach the StockSense server. Check your connection and try again.";
  }
  if (/too many requests|ThrottlerException/i.test(message)) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (/status code 401|unauthorized/i.test(message)) return 'Your session has expired. Please sign in again.';
  if (/status code 403|forbidden/i.test(message)) return "You don't have permission to do that.";
  if (/status code 404/i.test(message)) return 'That record could not be found.';
  if (/status code 5\d\d/i.test(message)) return 'The server had a problem. Please try again shortly.';
  return message;
}
