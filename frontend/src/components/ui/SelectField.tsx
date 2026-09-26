import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { inputClass } from './FormField';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
  options: SelectOption[];
  /** Renders a first option with value "" (e.g. "All categories"). */
  placeholder?: string;
  /** 'pill' = compact rounded filter control (like the reference's "24h ⌄"). */
  variant?: 'field' | 'pill';
}

// Native select (keeps keyboard + screen-reader behaviour for free), styled to
// match FormField. Works bare (filters) or labelled (forms) and forwards its ref
// so react-hook-form can register it.
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, options, placeholder, variant = 'field', className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const pill = variant === 'pill';
  const select = (
    <div className={cn('relative', !label && className)}>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        {...rest}
        className={cn(
          'cursor-pointer appearance-none',
          pill
            ? 'h-9 max-w-[16rem] truncate rounded-full border border-sienna/10 bg-white pl-4 pr-9 text-[13px] font-medium text-ink transition-colors hover:border-sienna/25 focus:border-sienna/35 focus:outline-none focus:ring-4 focus:ring-sienna/10'
            : cn(inputClass, 'h-11 pr-10'),
          error && 'border-danger/50',
        )}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-2', pill ? 'right-3 h-3.5 w-3.5' : 'right-3.5 h-4 w-4')}
        aria-hidden
      />
    </div>
  );
  if (!label) return select;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={selectId} className="block text-[13px] font-medium text-chocolate">
        {label}
      </label>
      {select}
      {error ? (
        <p className="text-[12px] font-medium text-danger-fg">{error}</p>
      ) : (
        hint && <p className="text-[12px] text-ink-2">{hint}</p>
      )}
    </div>
  );
});
