import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CHART } from '@/lib/status';

/* ---------------------------------------------------------------------------
   Lightweight SVG charts in the StockSense language: warm series colours, a
   near-invisible grid, and a dark pill tooltip (like the reference).
   Dependency-free so they render the same in the browser and in tests.
   --------------------------------------------------------------------------- */

export interface Point {
  label: string;
  value: number;
  /** Optional extra line in the tooltip. */
  detail?: string;
}

/** Smooth path through points with monotone cubic interpolation (no overshoot below zero). */
function smoothPath(pts: Array<[number, number]>) {
  const n = pts.length;
  if (n === 0) return '';
  if (n < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const slope = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / (dx[i] || 1));
  const m = pts.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    return slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  });
  // Fritsch–Carlson: limit tangents so each segment stays monotone.
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + m[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - m[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

interface AreaChartProps {
  data: Point[];
  height?: number;
  color?: string;
  formatValue?: (n: number) => string;
  /** Show every Nth x label (keeps dense series readable). */
  labelEvery?: number;
  ariaLabel: string;
}

export function AreaChart({ data, height = 168, color = CHART.onHand, formatValue = String, labelEvery = 1, ariaLabel }: AreaChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 100;
  const max = Math.max(1, ...data.map((d) => d.value));
  const pts = useMemo<Array<[number, number]>>(
    () =>
      data.map((d, i) => [data.length === 1 ? W / 2 : (i / (data.length - 1)) * W, H - 8 - (d.value / max) * (H - 18)]),
    [data, max],
  );
  const line = smoothPath(pts);
  const area = pts.length ? `${line} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z` : '';
  const gradientId = useMemo(() => `area-${Math.random().toString(36).slice(2, 8)}`, []);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    setHover(Math.round(x * (data.length - 1)));
  };

  const active = hover !== null ? data[hover] : null;
  const activePt = hover !== null ? pts[hover] : null;

  return (
    <div>
      <div
        className="relative"
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={ariaLabel}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke={CHART.grid} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} fill={`url(#${gradientId})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {activePt && (
            <line
              x1={activePt[0]}
              x2={activePt[0]}
              y1="0"
              y2={H}
              stroke={color}
              strokeOpacity="0.35"
              strokeDasharray="3 4"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {active && activePt && (
          <>
            <span
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${(activePt[0] / W) * 100}%`, top: `${(activePt[1] / H) * 100}%`, background: color }}
            />
            <span
              className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-raspberry px-3 py-1.5 text-[12px] font-semibold text-white shadow-pop animate-fade-in"
              style={{ left: `clamp(48px, ${(activePt[0] / W) * 100}%, calc(100% - 48px))`, top: `calc(${(activePt[1] / H) * 100}% - 40px)` }}
            >
              {formatValue(active.value)}
              <span className="ml-1.5 font-normal text-white/60">{active.label}</span>
            </span>
          </>
        )}
      </div>
      <div className="relative mt-3 h-4 text-[11px] font-medium text-ink-2">
        {data.map((d, i) => i % labelEvery === 0 && (
          <span
            key={`${d.label}-${i}`}
            className={cn('absolute whitespace-nowrap', (i / labelEvery) % 2 !== 0 && 'hidden sm:block')}
            style={{
              left: `${data.length > 1 ? (i / (data.length - 1)) * 100 : 0}%`,
              transform: i === 0 ? undefined : i === data.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface Segment {
  label: string;
  value: number;
  color: string;
}

/** Donut with a centred total. Legend is separate so layouts stay flexible. */
export function Donut({ segments, size = 168, thickness = 18, center, ariaLabel }: { segments: Segment[]; size?: number; thickness?: number; center?: ReactNode; ariaLabel: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={ariaLabel}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(192 186 179 / 0.22)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s) => {
            const len = (s.value / total) * c;
            const dash = Math.max(0, len - gap);
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap={dash > 6 ? 'round' : 'butt'}
                className="transition-[stroke-dasharray] duration-700 ease-soft"
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      {center && <div className="absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}

/** Stacked horizontal bar with an optional marker (e.g. reorder minimum). */
export function SegmentBar({ parts, max, marker, className, ariaLabel }: { parts: Segment[]; max: number; marker?: number | null; className?: string; ariaLabel: string }) {
  const safeMax = Math.max(max, 1e-9);
  return (
    <div className={cn('relative h-2.5 w-full overflow-hidden rounded-full bg-dove/20', className)} role="img" aria-label={ariaLabel}>
      <div className="flex h-full">
        {parts.map((p) => (
          <span
            key={p.label}
            className="h-full transition-[width] duration-700 ease-soft first:rounded-l-full last:rounded-r-full"
            style={{ width: `${Math.max(0, (p.value / safeMax) * 100)}%`, background: p.color }}
            title={`${p.label}: ${p.value}`}
          />
        ))}
      </div>
      {marker != null && marker > 0 && marker <= safeMax && (
        <span className="absolute top-[-3px] h-[calc(100%+6px)] w-[2px] rounded-full bg-raspberry/70" style={{ left: `${(marker / safeMax) * 100}%` }} aria-hidden />
      )}
    </div>
  );
}

export function Legend({ items, className }: { items: Array<{ label: string; color: string; value?: ReactNode }>; className?: string }) {
  return (
    <ul className={cn('space-y-2.5', className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center justify-between gap-4 text-[13px]">
          <span className="flex items-center gap-2.5 text-ink-2">
            <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: i.color }} aria-hidden />
            {i.label}
          </span>
          {i.value !== undefined && <span className="tabular font-semibold text-ink">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}
