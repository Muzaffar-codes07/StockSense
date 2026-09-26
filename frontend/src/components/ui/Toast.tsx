import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { friendlyError } from './States';

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastApi {
  toast: (t: { title: string; description?: string; tone?: ToastTone }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, err?: unknown) => void;
}

const noop = () => {};
const ToastContext = createContext<ToastApi>({ toast: noop, success: noop, error: noop });

export const useToast = () => useContext(ToastContext);

const icons = { success: CheckCircle2, error: AlertTriangle, info: Info };
const iconTone = { success: 'text-success', error: 'text-danger', info: 'text-info' };

/** Quiet confirmations for mutations; errors stay until dismissed or 7s pass. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);

  const toast = useCallback<ToastApi['toast']>(
    ({ title, description, tone = 'info' }) => {
      const id = nextId.current++;
      setItems((all) => [...all.slice(-3), { id, title, description, tone }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (title, description) => toast({ title, description, tone: 'success' }),
      error: (title, err) =>
        toast({ title, description: err instanceof Error ? friendlyError(err.message) : undefined, tone: 'error' }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex w-[360px] max-w-[calc(100vw-40px)] -translate-x-1/2 flex-col gap-2">
        {items.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="glass-dark pointer-events-auto flex items-start gap-3 rounded-[16px] px-4 py-3.5 text-ondark shadow-pop animate-toast-in"
            >
              <Icon className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', iconTone[t.tone])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[12.5px] text-ondark/70">{t.description}</p>}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
                className="grid h-6 w-6 place-items-center rounded-full text-ondark/60 hover:bg-white/10 hover:text-ondark"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
