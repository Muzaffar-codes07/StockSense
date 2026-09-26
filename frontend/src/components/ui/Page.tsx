import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';

interface PageMeta {
  title: string;
  subtitle?: string;
  /** Small line above the title, e.g. a breadcrumb. */
  eyebrow?: ReactNode;
}

interface PageMetaContextValue {
  meta: PageMeta;
  setMeta: (meta: PageMeta) => void;
}

const PageMetaContext = createContext<PageMetaContextValue>({
  meta: { title: '' },
  setMeta: () => {},
});

export function PageMetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<PageMeta>({ title: '' });
  return <PageMetaContext.Provider value={{ meta, setMeta }}>{children}</PageMetaContext.Provider>;
}

export const usePageMetaValue = () => useContext(PageMetaContext).meta;

/**
 * Pages declare their title here; the app shell renders it in the top bar next
 * to search, notifications and the user menu. No-op outside the shell (tests).
 */
export function usePageMeta(title: string, subtitle?: string, eyebrow?: ReactNode) {
  const { setMeta } = useContext(PageMetaContext);
  useEffect(() => {
    setMeta({ title, subtitle, eyebrow });
    document.title = title ? `${title} · StockSense` : 'StockSense';
    // eyebrow is display-only; re-running on identity changes would loop.
  }, [setMeta, title, subtitle]);
}

interface SectionProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

/** A titled block of a page — the title sits outside the card, as in the reference. */
export function Section({ title, description, actions, children, className, id }: SectionProps) {
  return (
    <section id={id} className={cn('min-w-0', className)} aria-label={typeof title === 'string' ? title : undefined}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-title text-ink">{title}</h2>}
            {description && <p className="mt-1 text-[13px] text-ink-2">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Row of in-app sub-navigation pills (e.g. Receipts / Deliveries / …). */
export function SubNav({ items, label }: { items: Array<{ to: string; label: string; icon?: ReactNode; end?: boolean; count?: number }>; label: string }) {
  return (
    <nav aria-label={label} className="scroll-quiet -mx-1 mb-6 flex gap-1 overflow-x-auto px-1">
      <div className="inline-flex items-center gap-1 rounded-full bg-canvas p-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150',
                isActive
                  ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(22_15_12/0.08),0_2px_8px_rgb(22_15_12/0.06)]'
                  : 'text-ink-2 hover:text-ink',
              )
            }
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && item.count > 0 && (
              <span className="tabular rounded-full bg-sienna/[0.08] px-1.5 text-[11px] text-sienna">{item.count}</span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Key/value line used in detail sheets. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2.5">
      <dt className="shrink-0 text-[13px] text-ink-2">{label}</dt>
      <dd className="min-w-0 text-right text-[13.5px] font-medium text-ink">{children}</dd>
    </div>
  );
}

/** Compact metric for summaries (product detail, sheets). */
export function Metric({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'warning' | 'danger' | 'success' }) {
  const toneClass = { default: 'text-ink', warning: 'text-warning-fg', danger: 'text-danger-fg', success: 'text-success-fg' }[tone ?? 'default'];
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-medium text-ink-2">{label}</p>
      <p className={cn('tabular mt-1 text-[22px] font-bold leading-7 tracking-tight', toneClass)}>{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-ink-2">{hint}</p>}
    </div>
  );
}
