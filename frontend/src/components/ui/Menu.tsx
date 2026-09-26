import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
}

interface MenuProps {
  items: MenuItem[];
  label?: string;
  /** Custom trigger content; defaults to a kebab icon. */
  trigger?: ReactNode;
  align?: 'left' | 'right';
  /** Open upwards (e.g. from a sheet footer). */
  side?: 'bottom' | 'top';
  triggerClassName?: string;
}

/** Small action menu (row actions, card kebabs). Escape / outside click close it. */
export function Menu({ items, label = 'More actions', trigger, align = 'right', side = 'bottom', triggerClassName }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          'grid h-8 w-8 place-items-center rounded-full text-ink-2 transition-colors hover:bg-dove/25 hover:text-ink',
          open && 'bg-dove/25 text-ink',
          triggerClassName,
        )}
      >
        {trigger ?? <MoreHorizontal className="h-4 w-4" />}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'glass-strong absolute z-30 min-w-[196px] rounded-[14px] p-1.5 shadow-pop animate-pop-in',
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                title={item.hint}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  item.danger ? 'text-danger-fg hover:bg-danger/[0.08]' : 'text-ink hover:bg-dove/20',
                )}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
