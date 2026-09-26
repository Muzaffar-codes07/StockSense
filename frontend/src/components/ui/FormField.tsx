import type { InputHTMLAttributes } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

// Label + input + inline error. Pairs with react-hook-form + zod so client-side
// validation shows the same graceful messages the API returns.
export function FormField({ label, error, ...inputProps }: FormFieldProps) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <input
        {...inputProps}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
}
