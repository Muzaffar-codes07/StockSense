import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type CardTone = 'surface' | 'glass' | 'dove' | 'mist' | 'blush' | 'sienna' | 'raspberry';

// Card colour language: white for working data, warm tints for secondary
// information, dark only for the single high-emphasis module on a screen.
const tones: Record<CardTone, string> = {
  surface: 'bg-surface ring-1 ring-inset ring-sienna/[0.06] shadow-card',
  glass: 'glass',
  dove: 'bg-[linear-gradient(150deg,rgb(192_186_179/0.30),rgb(192_186_179/0.16))] ring-1 ring-inset ring-white/60',
  mist: 'bg-[linear-gradient(150deg,rgb(116_134_154/0.13),rgb(116_134_154/0.06))] ring-1 ring-inset ring-white/60',
  blush: 'bg-[linear-gradient(150deg,rgb(57_18_20/0.07),rgb(192_186_179/0.14))] ring-1 ring-inset ring-white/60',
  sienna: 'bg-sienna text-ondark shadow-lift',
  raspberry: 'bg-raspberry text-ondark shadow-lift',
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  size?: 'lg' | 'md';
  padded?: boolean;
  interactive?: boolean;
}

export function Card({ tone = 'surface', size = 'lg', padded = true, interactive, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'relative',
        size === 'lg' ? 'rounded-card' : 'rounded-card-sm',
        padded && (size === 'lg' ? 'p-6' : 'p-5'),
        tones[tone],
        interactive && 'transition-[transform,box-shadow] duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-lift',
        className,
      )}
      {...rest}
    />
  );
}

interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Use 'h2' for page sections, 'h3' inside nested layouts. */
  as?: 'h2' | 'h3';
}

export function CardHeader({ title, subtitle, actions, className, as: Heading = 'h2' }: CardHeaderProps) {
  return (
    <div className={cn('mb-5 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <Heading className="text-title text-current">{title}</Heading>
        {subtitle && <p className="mt-1 text-[13px] text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex max-w-full shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
