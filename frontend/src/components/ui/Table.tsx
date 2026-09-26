import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ErrorState, Skeleton } from './States';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Tailwind width class, e.g. 'w-40'. */
  width?: string;
  /** Hide on narrow screens (below lg). */
  hideOnMobile?: boolean;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  /** Shown when there are no rows (string or a full EmptyState). */
  empty?: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T, index: number) => string;
  /** Row the user is inspecting (e.g. open in a side sheet). */
  selectedKey?: string | null;
  className?: string;
  /** Plain = no outer card (when the table already sits inside a Card). */
  plain?: boolean;
  caption?: string;
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' };

const isInteractive = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, [role="menu"]'));

// The shared data table. Real <table> semantics for screen readers, minimal
// separators, comfortable rows, subtle hover — never glass-blurred rows.
export function Table<T extends object>({
  columns,
  rows,
  empty = 'No records',
  loading,
  error,
  onRetry,
  onRowClick,
  rowKey,
  selectedKey,
  className,
  plain,
  caption,
}: TableProps<T>) {
  const colSpan = columns.length;

  const activate = (row: T) => (e: MouseEvent | KeyboardEvent) => {
    if (!onRowClick || isInteractive(e.target)) return;
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    if ('key' in e) e.preventDefault();
    onRowClick(row);
  };

  let body: ReactNode;
  if (error) {
    body = (
      <tr>
        <td colSpan={colSpan}>
          <ErrorState message={error} onRetry={onRetry} compact />
        </td>
      </tr>
    );
  } else if (loading && rows.length === 0) {
    body = Array.from({ length: 5 }, (_, i) => (
      <tr key={`sk-${i}`} className="border-t hairline">
        {columns.map((c, ci) => (
          <td key={c.key} className={cn('px-5 py-4', c.hideOnMobile && 'hidden lg:table-cell')}>
            <Skeleton className={cn('h-3.5', ci === 0 ? 'w-40' : 'w-16', c.align === 'right' && 'ml-auto')} />
          </td>
        ))}
      </tr>
    ));
  } else if (rows.length === 0) {
    body = (
      <tr>
        <td colSpan={colSpan} className="px-5 py-10 text-center text-[13px] text-ink-2">
          {empty}
        </td>
      </tr>
    );
  } else {
    body = rows.map((row, i) => {
      const key = rowKey ? rowKey(row, i) : String((row as { id?: unknown }).id ?? i);
      const selected = selectedKey != null && selectedKey === key;
      return (
        <tr
          key={key}
          onClick={onRowClick ? activate(row) : undefined}
          onKeyDown={onRowClick ? activate(row) : undefined}
          tabIndex={onRowClick ? 0 : undefined}
          aria-selected={onRowClick ? selected : undefined}
          className={cn(
            'border-t hairline transition-colors duration-150',
            onRowClick && 'cursor-pointer focus-visible:bg-dove/15 focus-visible:outline-none',
            selected ? 'bg-dove/20' : 'hover:bg-dove/[0.12]',
          )}
        >
          {columns.map((c) => (
            <td
              key={c.key}
              className={cn(
                'px-5 py-3.5 align-middle text-[13.5px] text-ink',
                alignClass[c.align ?? 'left'],
                c.hideOnMobile && 'hidden lg:table-cell',
              )}
            >
              {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
            </td>
          ))}
        </tr>
      );
    });
  }

  return (
    <div
      className={cn(
        'scroll-quiet overflow-x-auto',
        !plain && 'rounded-card bg-surface ring-1 ring-inset ring-sienna/[0.06] shadow-card',
        className,
      )}
    >
      <table className="w-full min-w-[640px] border-collapse">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'sticky top-0 z-[1] bg-surface/95 px-5 pb-3 pt-4 text-[12px] font-medium text-ink-2 backdrop-blur',
                  alignClass[c.align ?? 'left'],
                  c.width,
                  c.hideOnMobile && 'hidden lg:table-cell',
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody aria-busy={loading || undefined}>{body}</tbody>
      </table>
    </div>
  );
}
