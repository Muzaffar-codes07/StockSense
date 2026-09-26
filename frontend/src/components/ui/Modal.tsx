import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';
import { useOverlay } from './useOverlay';

interface ModalProps {
  open: boolean;
  title?: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const widths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-3xl' };

/** Frosted modal for quick, focused tasks. Escape and backdrop both close it. */
export function Modal({ open, title, description, onClose, children, footer, size = 'md' }: ModalProps) {
  const panelRef = useOverlay<HTMLDivElement>(open, onClose);
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-raspberry/35 p-3 animate-fade-in backdrop-blur-[3px] sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'glass-strong flex max-h-[min(88vh,860px)] w-full flex-col overflow-hidden rounded-card shadow-pop outline-none animate-pop-in',
          widths[size],
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
            <div className="min-w-0">
              {title && <h2 className="text-title text-ink">{title}</h2>}
              {description && <p className="mt-1 text-[13px] text-ink-2">{description}</p>}
            </div>
            <IconButton label="Close" tone="plain" size="sm" onClick={onClose} className="-mr-1 -mt-1">
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        )}
        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-3">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t hairline bg-white/60 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
