import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Shared input look — used by FormField, SelectField and ad-hoc inputs. */
export const inputClass =
  'w-full rounded-control border border-sienna/10 bg-white/85 px-3.5 text-[14px] text-ink placeholder:text-ink-3 ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-sienna/20 ' +
  'focus:border-sienna/35 focus:outline-none focus:ring-4 focus:ring-sienna/10 ' +
  'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-2 read-only:bg-canvas read-only:text-ink-2';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Trailing adornment inside the input (e.g. a unit). */
  suffix?: ReactNode;
}

// Label + input + inline error/hint. Forwards its ref so react-hook-form's
// register() can read and prefill the input.
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, error, hint, suffix, className, id, ...inputProps },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={inputId} className="block text-[13px] font-medium text-chocolate">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...inputProps}
          className={cn(inputClass, 'h-11', suffix ? 'pr-14' : undefined, error && 'border-danger/50 focus:border-danger/60 focus:ring-danger/10')}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[13px] text-ink-2">
            {suffix}
          </span>
        )}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-[12px] font-medium text-danger-fg">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${inputId}-hint`} className="text-[12px] text-ink-2">
            {hint}
          </p>
        )
      )}
    </div>
  );
});
