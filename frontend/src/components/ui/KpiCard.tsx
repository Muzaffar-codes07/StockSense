import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  accent?: 'default' | 'warning' | 'danger';
}

// Dashboard KPI tile (Role 2). Feed values from Role 3 (stock) & Role 4 (ops).
export function KpiCard({ label, value, accent = 'default' }: KpiCardProps) {
  const accentClass = {
    default: 'text-slate-800',
    warning: 'text-amber-600',
    danger: 'text-red-600',
  }[accent];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accentClass}`}>{value}</p>
    </div>
  );
}
