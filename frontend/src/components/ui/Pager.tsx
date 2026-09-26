import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface PagerProps {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  total?: number;
  pageSize?: number;
  className?: string;
}

// Pagination under list tables. Shows the visible range when totals are known;
// hidden entirely when everything fits on one page.
export function Pager({ page, totalPages, onPage, total, pageSize, className }: PagerProps) {
  if (totalPages <= 1) return null;
  const from = total !== undefined && pageSize ? (page - 1) * pageSize + 1 : undefined;
  const to = total !== undefined && pageSize ? Math.min(page * pageSize, total) : undefined;
  const nav =
    'grid h-9 w-9 place-items-center rounded-full border border-sienna/10 bg-white text-ink transition-colors hover:border-sienna/25 disabled:cursor-not-allowed disabled:opacity-35';
  return (
    <nav aria-label="Pagination" className={cn('mt-5 flex items-center justify-between gap-3 text-[13px] text-ink-2', className)}>
      <span className="tabular">
        {from !== undefined ? (
          <>
            {from}–{to} of {total}
          </>
        ) : (
          <>
            Page {page} of {totalPages}
          </>
        )}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Previous page" className={nav} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="tabular min-w-[64px] text-center font-medium text-ink">
          {page} / {totalPages}
        </span>
        <button type="button" aria-label="Next page" className={nav} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
