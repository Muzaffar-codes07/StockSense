interface PagerProps {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}

// Previous / next pagination under list tables. Hidden when there is one page.
export function Pager({ page, totalPages, onPage }: PagerProps) {
  if (totalPages <= 1) return null;
  const button =
    'rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="mt-4 flex items-center justify-end gap-3 text-sm text-slate-600">
      <button type="button" className={button} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className={button}
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
