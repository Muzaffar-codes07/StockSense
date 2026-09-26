import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CornerDownLeft, Package, Plus, Search, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { productsApi } from '@/features/products/api';
import { useOverlay } from '@/components/ui/useOverlay';
import { MAIN_NAV, OPERATION_NAV, SETTINGS_NAV } from './nav';

interface Entry {
  id: string;
  group: 'Go to' | 'Products' | 'Create';
  label: string;
  hint?: string;
  icon: LucideIcon;
  to: string;
}

const PAGES: Entry[] = [
  ...MAIN_NAV,
  ...OPERATION_NAV,
  SETTINGS_NAV,
  { to: '/profile', label: 'My profile', icon: User, description: 'Your account' },
].map((n) => ({ id: `page:${n.to}`, group: 'Go to', label: n.label, hint: n.description, icon: n.icon, to: n.to }));

const CREATE: Entry[] = [
  { id: 'new:product', group: 'Create', label: 'New product', icon: Plus, to: '/products?new=1' },
  { id: 'new:receipt', group: 'Create', label: 'New receipt', icon: Plus, to: '/operations/receipts?new=1' },
  { id: 'new:delivery', group: 'Create', label: 'New delivery', icon: Plus, to: '/operations/deliveries?new=1' },
  { id: 'new:transfer', group: 'Create', label: 'New transfer', icon: Plus, to: '/operations/transfers?new=1' },
  { id: 'new:adjustment', group: 'Create', label: 'New adjustment', icon: Plus, to: '/operations/adjustments?new=1' },
];

const matches = (e: Entry, q: string) => `${e.label} ${e.hint ?? ''}`.toLowerCase().includes(q);

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const panelRef = useOverlay<HTMLDivElement>(open, onClose);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const q = query.trim().toLowerCase();
  const debounced = useDebouncedValue(q, 200);

  const products = useQuery({
    queryKey: ['palette', 'products', debounced],
    queryFn: () => productsApi.list({ search: debounced, pageSize: 6 }),
    enabled: open && debounced.length > 0,
    staleTime: 15_000,
  });

  const entries = useMemo<Entry[]>(() => {
    const productEntries: Entry[] = (Array.isArray(products.data?.data) ? products.data!.data : []).map((p) => ({
      id: `product:${p.id}`,
      group: 'Products',
      label: p.name,
      hint: `${p.sku} · ${p.onHand} ${p.uom} on hand`,
      icon: Package,
      to: `/products/${p.id}`,
    }));
    if (!q) return [...PAGES.slice(0, 7), ...CREATE];
    return [...PAGES.filter((e) => matches(e, q)), ...(debounced ? productEntries : []), ...CREATE.filter((e) => matches(e, q))];
  }, [q, debounced, products.data]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
    }
  }, [open]);
  useEffect(() => setCursor(0), [q]);

  if (!open) return null;

  const choose = (e: Entry) => {
    onClose();
    navigate(e.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, entries.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter' && entries[cursor]) {
      e.preventDefault();
      choose(entries[cursor]);
    }
  };

  let lastGroup = '';
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-raspberry/40 px-4 pt-[12vh] animate-fade-in backdrop-blur-[3px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="glass-dark w-full max-w-[600px] overflow-hidden rounded-card text-ondark shadow-pop animate-pop-in"
      >
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-5">
          <Search className="h-[18px] w-[18px] text-ondark/50" aria-hidden />
          <input
            data-autofocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search products, pages, actions…"
            aria-label="Search StockSense"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={entries[cursor] ? `palette-${entries[cursor].id}` : undefined}
            className="h-14 flex-1 bg-transparent text-[15px] text-ondark placeholder:text-ondark/40 focus:outline-none"
          />
          <kbd className="rounded-[7px] bg-white/10 px-1.5 py-0.5 text-[11px] text-ondark/60">Esc</kbd>
        </div>
        <ul id="palette-results" role="listbox" className="scroll-quiet max-h-[52vh] overflow-y-auto p-2">
          {entries.length === 0 && (
            <li className="px-4 py-10 text-center text-[13px] text-ondark/50">
              {products.isFetching ? 'Searching…' : `No results for “${query}”`}
            </li>
          )}
          {entries.map((e, i) => {
            const header = e.group !== lastGroup ? e.group : null;
            lastGroup = e.group;
            const Icon = e.icon;
            return (
              <li key={e.id} role="presentation">
                {header && <p className="px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ondark/40">{header}</p>}
                <button
                  type="button"
                  id={`palette-${e.id}`}
                  role="option"
                  aria-selected={i === cursor}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => choose(e)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors',
                    i === cursor ? 'bg-white/[0.09]' : 'hover:bg-white/[0.05]',
                  )}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-white/[0.07] text-ondark/80">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{e.label}</span>
                    {e.hint && <span className="block truncate text-[12px] text-ondark/50">{e.hint}</span>}
                  </span>
                  {i === cursor && <CornerDownLeft className="h-4 w-4 text-ondark/50" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
