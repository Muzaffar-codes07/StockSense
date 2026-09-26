import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface FilterOption {
  label: string;
  value: string;
}

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

/** Unobtrusive rounded search field with a clear button. */
export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search', className }: SearchInputProps) {
  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" aria-hidden />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-full border border-sienna/10 bg-white pl-10 pr-9 text-[13px] text-ink placeholder:text-ink-3 transition-colors hover:border-sienna/20 focus:border-sienna/35 focus:outline-none focus:ring-4 focus:ring-sienna/10 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-ink-2 hover:bg-dove/30 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

interface FilterBarProps {
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode; // pill selects / chips for status, type, warehouse, category
  /** Number of active non-search filters, shown with a Clear action. */
  activeCount?: number;
  onClear?: () => void;
  trailing?: ReactNode;
  className?: string;
}

// The one filter architecture used on every list: search + compact pills +
// active count + clear. Never a giant filter form.
export function FilterBar({
  search,
  onSearch,
  searchPlaceholder = 'Search name or SKU…',
  children,
  activeCount = 0,
  onClear,
  trailing,
  className,
}: FilterBarProps) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-center gap-2.5', className)}>
      {onSearch && <SearchInput value={search ?? ''} onChange={onSearch} placeholder={searchPlaceholder} />}
      {children}
      {activeCount > 0 && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink-2 transition-colors hover:bg-dove/20 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
        </button>
      )}
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}

interface ChipGroupProps<V extends string> {
  label: string;
  value: V;
  onChange: (v: V) => void;
  options: Array<{ value: V; label: string; count?: number }>;
  className?: string;
}

/** Segmented pill chips — for status / type filters and in-page tabs. */
export function ChipGroup<V extends string>({ label, value, onChange, options, className }: ChipGroupProps<V>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex flex-wrap items-center gap-1 rounded-full bg-canvas p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150',
              active ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(22_15_12/0.08),0_2px_8px_rgb(22_15_12/0.06)]' : 'text-ink-2 hover:text-ink',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn('tabular rounded-full px-1.5 text-[11px]', active ? 'bg-sienna/[0.08] text-sienna' : 'bg-dove/30 text-ink-2')}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
