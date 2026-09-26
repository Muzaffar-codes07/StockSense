import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,box-shadow,transform] duration-150 ease-soft active:translate-y-px disabled:pointer-events-none disabled:opacity-45';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-sienna text-white shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_6px_16px_rgb(57_18_20/0.22)] hover:bg-sienna-hover active:bg-sienna-press',
  secondary: 'bg-dove/25 text-sienna ring-1 ring-inset ring-sienna/[0.08] hover:bg-dove/40',
  outline: 'bg-surface text-ink ring-1 ring-inset ring-sienna/[0.12] hover:bg-dove/15',
  ghost: 'text-ink-2 hover:bg-dove/20 hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger-fg',
  dark: 'bg-raspberry text-ondark hover:bg-chocolate',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-[10px] px-3 text-[13px]',
  md: 'h-10 rounded-control px-4 text-sm',
  lg: 'h-11 rounded-control px-5 text-[15px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

type ButtonLinkProps = LinkProps & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

/** A router link that looks exactly like a Button. */
export function ButtonLink({ variant = 'primary', size = 'md', icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only controls need an accessible name. */
  label: string;
  tone?: 'light' | 'plain' | 'dark';
  size?: 'sm' | 'md';
}

/** Round icon control, like the search / notification buttons in the top bar. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = 'light', size = 'md', className, children, type = 'button', ...rest },
  ref,
) {
  const tones = {
    light: 'bg-canvas text-ink hover:bg-dove/30',
    plain: 'text-ink-2 hover:bg-dove/20 hover:text-ink',
    dark: 'bg-white/[0.06] text-ondark hover:bg-white/[0.12]',
  };
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40',
        size === 'md' ? 'h-10 w-10' : 'h-8 w-8',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
