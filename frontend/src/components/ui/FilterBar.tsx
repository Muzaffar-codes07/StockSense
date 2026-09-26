import type { ReactNode } from 'react';

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterBarProps {
  search?: string;
  onSearch?: (v: string) => void;
  children?: ReactNode; // drop <select> filters here (status, type, warehouse, category)
}

// Shared filter bar used on every list (dynamic filters requirement).
// Role 2 owns it; Roles 3 & 4 pass their domain-specific <Select> filters.
export function FilterBar({ search, onSearch, children }: FilterBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {onSearch && (
        <input
          value={search ?? ''}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search (name / SKU)…"
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      )}
      {children}
    </div>
  );
}
