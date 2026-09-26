import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';
import { useOverlay } from './useOverlay';

interface SideSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Small line above the title, e.g. a document reference or type. */
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

const widths = { md: 'max-w-[440px]', lg: 'max-w-[560px]', xl: 'max-w-[720px]' };

/** Right-side sheet for details, deeper edits and movement inspection. */
export function SideSheet({
  open,
  onClose,
  title,
  eyebrow,
  subtitle,
  headerExtra,
  children,
  footer,
  width = 'lg',
}: SideSheetProps) {
  const panelRef = useOverlay<HTMLElement>(open, onClose);
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-raspberry/25 animate-fade-in backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'glass-strong m-2 flex w-full flex-col overflow-hidden rounded-panel shadow-pop outline-none animate-sheet-in sm:m-3',
          widths[width],
        )}
      >
        <header className="border-b hairline px-6 pb-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {eyebrow && <div className="mb-1.5 text-[12px] font-medium text-ink-2">{eyebrow}</div>}
              <h2 className="truncate text-[22px] font-bold leading-7 tracking-tight text-ink">{title}</h2>
              {subtitle && <div className="mt-1.5 text-[13px] text-ink-2">{subtitle}</div>}
            </div>
            <IconButton label="Close" tone="light" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>
          {headerExtra && <div className="mt-4">{headerExtra}</div>}
        </header>
        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t hairline bg-white/70 px-6 py-4">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}
