import { forwardRef, type SelectHTMLAttributes } from 'react';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  /** Renders a first option with value "" (e.g. "All categories"). */
  placeholder?: string;
}

// Native select styled like FormField. Works bare (filters) or labelled (forms),
// and forwards its ref so react-hook-form can register it.
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField({ label, error, options, placeholder, ...rest }, ref) {
    const select = (
      <select
        ref={ref}
        {...rest}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
    if (!label) return select;
    return (
      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        {select}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </label>
    );
  },
);
