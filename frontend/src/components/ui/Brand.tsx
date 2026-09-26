import { cn } from '@/lib/cn';

/**
 * The StockSense mark: an isometric inventory cube — three faces in the brand
 * palette, sitting on a warm tile (like the reference's logo tile).
 */
export function LogoMark({ className, tile = true }: { className?: string; tile?: boolean }) {
  const cube = (
    <svg viewBox="0 0 32 32" className={tile ? 'h-6 w-6' : className} aria-hidden>
      <path d="M16 3.5 27.5 10 16 16.5 4.5 10Z" fill="rgb(var(--ss-dove))" />
      <path d="M4.5 10 16 16.5V29.5L4.5 23Z" fill="rgb(var(--ss-chocolate))" />
      <path d="M27.5 10 16 16.5V29.5L27.5 23Z" fill="rgb(var(--ss-sienna))" />
      <path d="M16 16.5 27.5 10M16 16.5 4.5 10M16 16.5v13" stroke="rgb(255 255 255 / 0.35)" strokeWidth="0.8" fill="none" />
    </svg>
  );
  if (!tile) return cube;
  return (
    <span
      className={cn(
        'grid h-12 w-12 place-items-center rounded-[15px] bg-[linear-gradient(150deg,#F3EDE6,#E2D9CF)] shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_6px_16px_rgb(0_0_0/0.25)]',
        className,
      )}
    >
      {cube}
    </span>
  );
}

export function Wordmark({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark tile={false} className="h-7 w-7" />
      <span className="leading-none">
        <span className={cn('block text-[17px] font-bold tracking-tight', dark ? 'text-ondark' : 'text-ink')}>StockSense</span>
        <span className={cn('mt-1 block text-[11px] font-medium', dark ? 'text-ondark/55' : 'text-ink-2')}>Inventory Control</span>
      </span>
    </span>
  );
}

/** Initials avatar — warm dove disc, never a stock photo. */
export function Avatar({ name, size = 'md', className }: { name?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const initials =
    (name ?? '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';
  const sizes = { sm: 'h-7 w-7 text-[11px]', md: 'h-8 w-8 text-[12px]', lg: 'h-14 w-14 text-[18px]' };
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-[linear-gradient(150deg,#E8E2DB,#CFC7BE)] font-semibold text-sienna',
        sizes[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
